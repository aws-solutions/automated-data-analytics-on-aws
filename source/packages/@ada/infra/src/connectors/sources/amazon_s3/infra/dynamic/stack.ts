/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Bucket, IBucket } from 'aws-cdk-lib/aws-s3';
import {
  Choice,
  Condition,
  DefinitionBody,
  IStateMachine,
  LogLevel,
  Pass,
  StateMachine,
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import { Crawler } from '@ada/dynamic-infra/constructs/glue/crawler';
import {
  DynamicInfraStackProps,
  DynamicInfrastructureStackBase,
} from '@ada/dynamic-infra/stacks/dynamic-infrastructure-stack-base';
import { ISourceDetails__S3 } from '../..';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Rule } from 'aws-cdk-lib/aws-events';
import { Trail } from 'aws-cdk-lib/aws-cloudtrail';
import { getUniqueDataProductLogGroupName } from '@ada/cdk-core';

/**
 * Stack for dynamic infrastructure for an s3 source'd data product
 */
export class S3SourceStack extends DynamicInfrastructureStackBase {
  private sourceBucketReference: IBucket;

  constructor(scope: Construct, id: string, props: DynamicInfraStackProps) {
    super(scope, id, props);
  }

  protected getDefaultTransformRequired(): boolean {
    return true;
  }

  protected createDataSourceInfrastructureAndStateMachine(props: DynamicInfraStackProps): IStateMachine {
    const { dataProduct } = props;
    const { sourceDetails } = dataProduct;
    const sourceBucket = sourceDetails as ISourceDetails__S3;

    const { glueDatabase, glueSecurityConfigurationName } = this.staticInfrastructureReferences;

    // Grant the source access role access to the data source bucket
    this.sourceBucketReference = Bucket.fromBucketName(this, 'SourceBucket', sourceBucket.bucket);
    this.sourceBucketReference.grantRead(this.role, `${sourceBucket.key}*`);

    // Create a crawler which will read the source data from s3 and populate one or more tables
    const startTablePrefix = `${this.dataProductUniqueIdentifier}-start`;
    const crawler = new Crawler(this, 'StartCrawler', {
      targetGlueDatabase: glueDatabase,
      targetDescription: { s3Target: sourceBucket },
      tablePrefix: startTablePrefix,
      glueSecurityConfigurationName,
      sourceAccessRole: this.role,
    });

    const { executeCrawler, getCrawledTableDetails } = this.buildExecuteCrawlerAndDiscoverCrawledTableSteps(crawler);

    // Execute the crawler on the source data, and retrieve the crawled table details and apply transforms
    // on all discovered tables
    const definition = executeCrawler.next(
      new Choice(this, 'VerifyCrawlerStepFunctionOutput')
        // Look at the "status" field
        .when(
          Condition.stringEquals('$.Output.Payload.status', 'FAILED'),
          new Pass(this, 'DeconstructErrorFromStateMachineExecution', {
            parameters: {
              ErrorDetails: TaskInput.fromObject({
                Error: TaskInput.fromJsonPathAt('$.Output.Payload.error').value,
              }).value,
            },
          }).next(this.putErrorEventOnEventBridge),
        )
        .otherwise(getCrawledTableDetails.next(this.transformLoop.executeAllTransformsAndCompleteStateMachine())),
    );

    return new StateMachine(this, 'StateMachine', {
      tracingEnabled: true,
      definitionBody: DefinitionBody.fromChainable(definition),
      role: this.role,
      logs: {
        destination: new LogGroup(this, 'StateMachineLogs', {
          logGroupName: getUniqueDataProductLogGroupName(
            this,
            'states',
            this.dataProductUniqueIdentifier,
            'StateMachineLogs',
          ),
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        level: LogLevel.ERROR,
      },
    });
  }

  protected createAutomaticDataUpdateTriggerRule(props: DynamicInfraStackProps): Rule {
    const { dataProduct } = props;
    const { sourceDetails } = dataProduct;
    const sourceBucket = sourceDetails as ISourceDetails__S3;

    // to enable cloud trail in the source bucket (to allow EventBridge events)
    const trail = new Trail(this, 'CloudTrail');
    trail.addS3EventSelector([
      {
        bucket: this.sourceBucketReference,
        objectPrefix: sourceBucket.key,
      },
    ]);

    // s3 events are coming from the default bus
    return new Rule(this, 'DataProductS3Rule', {
      // ruleName: `${this.dataProductUniqueIdentifier}-s3-events-to-workflow`,
      description: 'Rule matching S3 upload events',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventName: ['PutObject', 'CompleteMultipartUpload'],
          requestParameters: {
            bucketName: [sourceBucket.bucket],
            key: [{ prefix: sourceBucket.key }],
          },
        },
      },
    });
  }
}

export default S3SourceStack;
