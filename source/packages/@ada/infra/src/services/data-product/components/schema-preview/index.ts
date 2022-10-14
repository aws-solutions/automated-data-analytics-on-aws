/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Bucket } from '../../../../common/constructs/s3/bucket';
import { Construct } from 'constructs';
import { DockerImageFunction } from 'aws-cdk-lib/aws-lambda';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Effect, IRole, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import {
  ExternalSourceDataKmsAccessPolicyStatement,
  ExternalSourceDataS3AccessPolicyStatement,
  SolutionContext,
  TypescriptFunction,
  getDockerImagePath,
  tryGetSolutionContext,
} from '@ada/infra-common';
import { Key } from 'aws-cdk-lib/aws-kms';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { LogGroup } from '../../../../common/constructs/cloudwatch/log-group';
import { LogLevel, Pass, StateMachine, TaskInput } from 'aws-cdk-lib/aws-stepfunctions';
import { TarballImageAsset } from '../../../../common/constructs/ecr-assets/tarball-image-asset';
import { getUniqueStateMachineLogGroupName } from '@ada/cdk-core';
import { uniqueLambdaDescription } from '@ada/infra-common/constructs/lambda/utils';

const LAMBDA_ALIAS_NAME = 'prod';
export interface SchemaPreviewProps {
  readonly scriptBucket: Bucket;
  readonly dataBucket: Bucket;
  readonly productPreviewKey: Key;
  readonly accessLogsBucket: Bucket;
}

export default class SchemaPreview extends Construct {
  public readonly stateMachine: StateMachine;
  public readonly bucket: Bucket;

  constructor(
    scope: Construct,
    id: string,
    { scriptBucket, productPreviewKey, accessLogsBucket }: SchemaPreviewProps,
  ) {
    super(scope, id);

    // Bucket that can be used for any temporary data in the schema preview transforms
    this.bucket = new Bucket(this, 'TempBucket', {
      versioned: true,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: 'schema-preview-logs/',
      lifecycleRules: [
        {
          // delete objects after few days day
          enabled: true,
          expiration: Duration.days(5),
          noncurrentVersionExpiration: Duration.days(2),
          abortIncompleteMultipartUploadAfter: Duration.days(2),
        },
      ],
    });

    const pullDataSampleLambdaExecRole = new Role(this, 'PullDataSampleLambdaExecRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });

    // Grant KMS permission
    productPreviewKey.grantDecrypt(pullDataSampleLambdaExecRole);

    // Connector Role will be assumed by Lambda Exec role to perform the sampling work
    const pullDataSampleConnectorRole = new Role(this, 'PullDataSampleConnectorRole', {
      assumedBy: pullDataSampleLambdaExecRole,
    });

    pullDataSampleConnectorRole.assumeRolePolicy?.addStatements(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sts:TagSession'],
        principals: [pullDataSampleLambdaExecRole],
      })
    )

    // Grant read access to any s3 bucket for pulling data
    pullDataSampleConnectorRole.addToPolicy(ExternalSourceDataS3AccessPolicyStatement);
    // Grant access to any kms key in case these buckets are encrypted
    pullDataSampleConnectorRole.addToPolicy(ExternalSourceDataKmsAccessPolicyStatement);


    // Container Lambda for preview sampling
    const previewSchemaDockerImage = new TarballImageAsset(scope, 'Tarball', {
      tarballFile: getDockerImagePath('schema-preview'),
    });

    const buildDockerImageLambda = (handler: string, lambdaExecRole?: IRole) => {
      const lambdaId = `Lambda-${handler}`;
      const lambda = new DockerImageFunction(this, lambdaId, {
        // Use prebuilt docker image
        code: TarballImageAsset.tarballImageCode(previewSchemaDockerImage, {
          cmd: [`${handler}.handler`],
        }),
        memorySize: 3000,
        timeout: Duration.minutes(5),
        environment: {
          TEMP_BUCKET_NAME: this.bucket.bucketName,
          KEY_ID: productPreviewKey.keyId,
          PULL_DATA_SAMPLE_ROLE_ARN: pullDataSampleConnectorRole.roleArn,
        },
        // Force a new version for every deployment to avoid version already exists exception
        description: uniqueLambdaDescription(`Schema Preview ${handler}`),
        role: lambdaExecRole,
      });


      // Provisioned concurrency of 1 to reduce latency for initial spark context initialisation
      let provisionedConcurrentExecutions = tryGetSolutionContext(
        this,
        SolutionContext.JAVA_LAMBDA_PROVISIONED_CONCURRENT_EXECUTIONS
      );
      provisionedConcurrentExecutions = (provisionedConcurrentExecutions || 0) >= 1 ?
        provisionedConcurrentExecutions : undefined
      lambda.addAlias(LAMBDA_ALIAS_NAME, {
        provisionedConcurrentExecutions,
      });

      return lambda;
    };

    const pullDataSampleLambda = buildDockerImageLambda('pull_data_sample', pullDataSampleLambdaExecRole);

    pullDataSampleLambda.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sts:AssumeRole', 'sts:TagSession'],
        resources: [pullDataSampleConnectorRole.roleArn],
      }),
    );
    
    this.bucket.grantReadWrite(pullDataSampleLambda)
    productPreviewKey.grantDecrypt(pullDataSampleLambda);

    pullDataSampleLambda.addToRolePolicy(
      new PolicyStatement({
        resources: ['*'],
        actions: ['logs:CreateLogGroup', 'logs:PutLogEvents', 'logs:CreateLogStream'],
        effect: Effect.ALLOW,
      }),
    );

    const catchProps = {
      resultPath: '$.ErrorDetails',
    };

    const notifyError = new Pass(this, 'Failed');

    const pullDataSample = new LambdaInvoke(this, 'PullDataSample', {
      lambdaFunction: pullDataSampleLambda,
      payload: TaskInput.fromJsonPathAt('$'),
    }).addCatch(notifyError, catchProps);

    const discoverTransformsLambda = new TypescriptFunction(this, 'DiscoverTransformsLambda', {
      package: 'data-product-service',
      handlerFile: require.resolve('./handlers/preview-discover-transforms'),
      environment: {
        TEMP_BUCKET_NAME: this.bucket.bucketName,
        SCRIPT_BUCKET_NAME: scriptBucket.bucketName,
      },
      description: 'Discover transforms during preview',
      alias: LAMBDA_ALIAS_NAME,
    }).alias;
    scriptBucket.grantRead(discoverTransformsLambda);

    const discoverTransforms = new LambdaInvoke(this, 'DiscoverTransforms', {
      lambdaFunction: discoverTransformsLambda,
    }).addCatch(notifyError, catchProps);

    const executeTransformsLambda = buildDockerImageLambda('transform');
    // allow execute transform lambda to access temp bucket
    this.bucket.grantReadWrite(executeTransformsLambda)
    productPreviewKey.grantDecrypt(executeTransformsLambda);
    executeTransformsLambda.addToRolePolicy(
      new PolicyStatement({
        resources: ['*'],
        actions: ['logs:CreateLogGroup', 'logs:PutLogEvents', 'logs:CreateLogStream'],
        effect: Effect.ALLOW,
      }),
    );

    executeTransformsLambda.addToRolePolicy(ExternalSourceDataS3AccessPolicyStatement);

    const executeTransforms = new LambdaInvoke(this, 'ExecuteTransforms', {
      lambdaFunction: executeTransformsLambda,
    }).addCatch(notifyError, catchProps);

    const definition = pullDataSample.next(discoverTransforms).next(executeTransforms);

    this.stateMachine = new StateMachine(this, 'StateMachine', {
      tracingEnabled: true,
      definition,
      logs: {
        destination: new LogGroup(this, 'StateMachineLogs', {
          logGroupName: getUniqueStateMachineLogGroupName(this, `${id}StateMachineLogs`),
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        level: LogLevel.ERROR,
      },
    });
  }
}
