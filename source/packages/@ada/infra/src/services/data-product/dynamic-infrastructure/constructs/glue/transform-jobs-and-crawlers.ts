/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { DataProduct } from '@ada/api';
import { DataProductUpdatePolicy, DataSetIds } from '@ada/common';
import { Effect, IGrantable, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { ExternalFacingRole } from '@ada/infra-common/constructs/iam/external-facing-role';
import { ExternalSourceDataKmsAccessPolicyStatement } from '@ada/infra-common';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { IDatabase } from '@aws-cdk/aws-glue-alpha';
import { IKey } from 'aws-cdk-lib/aws-kms';
import { TransformJob, s3PathJoinWithTrailingSlash, toS3PathWithTrailingSlash } from '@ada/microservice-common';
import { getPossibleTransformsForDataProduct } from '../../../components/transforms/utils/transform-utils';
import Crawler from './crawler';
import Job from './job';

export interface TransformJobsAndCrawlersProps {
  readonly dataProductUniqueIdentifier: string;
  readonly database: IDatabase;
  readonly dataProduct: DataProduct;
  readonly dataBucket: IBucket;
  readonly dataBucketPath: string;
  readonly scriptBucket: IBucket;
  readonly glueKmsKey: IKey;
  readonly glueSecurityConfigurationName: string;
  readonly sourceAccessRole: ExternalFacingRole;
  readonly glueConnectionNames?: string[];
  readonly defaultTransformRequired: boolean;
  readonly extraJobArgs?: { [key: string]: string };
}

/**
 * Creates the glue jobs and crawlers required for the data product transform chain
 */
export default class TransformJobsAndCrawlers extends Construct {
  public readonly transformJobs: TransformJob[];
  public readonly glueJobs: Job[] = [];

  constructor(
    scope: Construct,
    id: string,
    {
      dataProductUniqueIdentifier,
      dataProduct,
      dataBucket,
      dataBucketPath,
      scriptBucket,
      database,
      glueKmsKey,
      glueSecurityConfigurationName,
      sourceAccessRole,
      glueConnectionNames,
      defaultTransformRequired,
      extraJobArgs,
    }: TransformJobsAndCrawlersProps,
  ) {
    super(scope, id);

    sourceAccessRole.addToPolicy(
      new PolicyStatement({
        actions: ['kms:GenerateDataKey', 'kms:Decrypt', 'kms:Encrypt'],
        effect: Effect.ALLOW,
        resources: [glueKmsKey.keyArn],
      }),
    );

    const { updatePolicy } = dataProduct.updateTrigger;
    // add glue job bookmark to handle the APPEND case
    const extraJobArgsForJobs =
      updatePolicy === DataProductUpdatePolicy.APPEND
        ? { ...extraJobArgs, '--job-bookmark-option': 'job-bookmark-enable' }
        : extraJobArgs;

    // Script bucket access is required for the jobs to read the scripts to execute
    scriptBucket.grantRead(sourceAccessRole);

    // NOTE: Consider accepting the kms key arn as input for s3-based data products to scope this role down.
    sourceAccessRole.addToPolicy(ExternalSourceDataKmsAccessPolicyStatement);

    /**
     * If the default transform is required and the user has not supplied any transforms, force this data
     * product to execute the default 'ada_parquet_data_type_map', which will force copying
     * data to s3 and thus be readable via Athena
     */
    if (defaultTransformRequired && dataProduct.transforms.length === 0) {
      dataProduct.transforms.push({ scriptId: 'ada_parquet_data_type_map', namespace: 'global' });
    }

    // Create a job and a crawler for every script that may be involved in the data product transform chain
    this.transformJobs = getPossibleTransformsForDataProduct(dataProduct).map((transform, i) => {
      const scriptId = `${transform.namespace}-${transform.scriptId}`;
      const outputS3Target = {
        bucket: dataBucket.bucketName,
        key: s3PathJoinWithTrailingSlash(dataBucketPath, 'transform', scriptId, `${i}`, DataSetIds.DEFAULT),
      };

      // The crawler is responsible for crawling the output of the job
      const tablePrefix = `${dataProductUniqueIdentifier}-transform-${i}-`;
      const crawler = new Crawler(this, `TransformOutputCrawler-${i}`, {
        targetGlueDatabase: database,
        targetDescription: { s3Target: outputS3Target },
        tablePrefix,
        glueSecurityConfigurationName,
        sourceAccessRole,
      }).crawler;

      const jobName = `${tablePrefix}-${scriptId}-${i}`;
      const job = new Job(this, `TransformJob-${scriptId}-${i}`, {
        name: jobName,
        transform,
        scriptBucket,
        glueSecurityConfigurationName,
        sourceAccessRole,
        //only the first ETL job needs connection to read from external data source, the rest of the transform read from bucket of the previous output
        glueConnectionNames:
          glueConnectionNames && glueConnectionNames.length > 0 && i == 0 ? glueConnectionNames : undefined,
        extraJobArgs: extraJobArgsForJobs,
      });
      this.glueJobs.push(job);

      return {
        ...transform,
        glueJobName: job.job.name!,
        outputS3Target,
        outputS3TargetPath: toS3PathWithTrailingSlash(outputS3Target),
        tempS3Path: toS3PathWithTrailingSlash({
          bucket: outputS3Target.bucket,
          key: s3PathJoinWithTrailingSlash(dataBucketPath, 'temp', jobName),
        }),
        outputCrawlerName: crawler.name!,
        outputCrawlerTablePrefix: tablePrefix,
      };
    });
  }

  public grantStartJobRuns = (identity: IGrantable) => this.glueJobs.forEach((job) => job.grantExecuteJob(identity));
}
