/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Alias } from 'aws-cdk-lib/aws-kms';
import { ArnFormat, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { CfnDeliveryStream } from 'aws-cdk-lib/aws-kinesisfirehose';
import {
  Choice,
  Condition,
  DefinitionBody,
  IStateMachine,
  LogLevel,
  Pass,
  StateMachine,
  TaskInput,
  Wait,
  WaitTime,
} from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import { Crawler } from '@ada/dynamic-infra/constructs/glue/crawler';
import { DataProductUpdatePolicy } from '@ada/common';
import {
  DynamicInfraStackProps,
  DynamicInfrastructureStackBase,
} from '@ada/dynamic-infra/stacks/dynamic-infrastructure-stack-base';
import { Effect, Policy, PolicyDocument, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { ISourceDetails__KINESIS } from '../..';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Rule } from 'aws-cdk-lib/aws-events';
import { S3Location } from '@ada/api';
import { Trail } from 'aws-cdk-lib/aws-cloudtrail';
import { getUniqueDataProductLogGroupName } from '@ada/cdk-core';

/**
 * Stack for dynamic infrastructure for an kinesis source'd data product
 */
export class KinesisSourceStack extends DynamicInfrastructureStackBase {
  private dataBucketFirehoseOutputPrefix: string;

  constructor(scope: Construct, id: string, props: DynamicInfraStackProps) {
    // override this connector to always use APPEND update policy
    props.dataProduct.updateTrigger.updatePolicy = DataProductUpdatePolicy.APPEND;
    super(scope, id, props);
  }

  protected getDefaultTransformRequired(): boolean {
    return false;
  }

  protected createExternalFacingRoleInlinePolicyStatements(props: DynamicInfraStackProps): {
    [key: string]: PolicyDocument;
  } {
    const { dataProduct } = props;
    const { sourceDetails } = dataProduct;
    const sourceStream = sourceDetails as ISourceDetails__KINESIS;
    const { dataBucket } = this.staticInfrastructureReferences;

    // Permissions are required at deploy time, during the creation of the delivery stream, and are therefore added
    // as inline policies since the delivery stream already has a dependency on the role. (The alternative would be
    // to add an additional dependency on the role's policy, which requires finding the node in the construct tree!)
    return {
      ...super.createExternalFacingRoleInlinePolicyStatements(props),
      kinesisPolicy: new PolicyDocument({
        statements: [
          // Grant access to write to the data bucket as the destination
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
              's3:AbortMultipartUpload',
              's3:GetBucketLocation',
              's3:GetObject',
              's3:ListBucket',
              's3:ListBucketMultipartUploads',
              's3:PutObject',
            ],
            resources: [`${dataBucket.bucketArn}`, `${dataBucket.bucketArn}/*`],
          }),
          // Grant access to read from the kinesis stream
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['kinesis:DescribeStream', 'kinesis:GetShardIterator', 'kinesis:GetRecords', 'kinesis:ListShards'],
            resources: [sourceStream.kinesisStreamArn],
          }),
          // Grant decrypt permissions for kms keys in case the kinesis stream is encrypted.
          new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['kms:Decrypt'],
            // NOTE: Consider accepting the KMS key arn as a parameter for encrypted streams. For now limit kms access to
            // only the source kinesis stream via conditions below
            resources: ['*'],
            conditions: {
              StringEquals: {
                'kms:ViaService': `kinesis.${this.region}.amazonaws.com`,
              },
              StringLike: {
                'kms:EncryptionContext:aws:kinesis:arn': sourceStream.kinesisStreamArn,
              },
            },
          }),
        ],
      }),
    };
  }

  protected createDataSourceInfrastructureAndStateMachine(props: DynamicInfraStackProps): IStateMachine {
    const { dataProduct } = props;
    const { sourceDetails } = dataProduct;
    const sourceStream = sourceDetails as ISourceDetails__KINESIS;

    const { glueDatabase, dataBucket, validateS3PathLambda, glueSecurityConfigurationName } =
      this.staticInfrastructureReferences;

    // Grant firehose access to assume the source access role
    this.role.assumeRolePolicy!.addStatements(
      new PolicyStatement({
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal('firehose.amazonaws.com')],
        actions: ['sts:AssumeRole'],
      }),
    );

    this.dataBucketFirehoseOutputPrefix = `${dataProduct.domainId}/${dataProduct.dataProductId}/${this.stackIdentifier}/firehose-output/`;

    const logGroup = new LogGroup(this, 'FirehoseLogGroup', {
      logGroupName: getUniqueDataProductLogGroupName(
        this,
        'firehose',
        this.dataProductUniqueIdentifier,
        'FirehoseLogs',
      ),
      retention: RetentionDays.TWO_YEARS,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const logStream = logGroup.addStream('FirehoseLogStream');

    // Setup the IAM policy for Log Groups
    const logGroupsPolicy = new Policy(this, 'KinesisFirehoseLogGroupsPolicy', {
      statements: [
        new PolicyStatement({
          actions: ['logs:PutLogEvents'],
          resources: [
            Stack.of(this).formatArn({
              service: 'logs',
              resource: 'log-group',
              arnFormat: ArnFormat.COLON_RESOURCE_NAME,
              resourceName: `${logGroup.logGroupName}:log-stream:${logStream.logStreamName}`,
            }),
          ],
        }),
      ],
    });

    logGroupsPolicy.attachToRole(this.role);

    new CfnDeliveryStream(this, 'DeliveryStream', {
      deliveryStreamType: 'KinesisStreamAsSource',
      kinesisStreamSourceConfiguration: {
        roleArn: this.role.roleArn,
        kinesisStreamArn: sourceStream.kinesisStreamArn,
      },
      extendedS3DestinationConfiguration: {
        bucketArn: dataBucket.bucketArn,
        // https://docs.aws.amazon.com/firehose/latest/dev/s3-prefixes.html
        // if no timestamp expression is specified in prefix, firehose will auto append a timestamp in format !{timestamp:yyyy/MM/dd/HH/}
        prefix: `${this.dataBucketFirehoseOutputPrefix}year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/`,
        errorOutputPrefix: `firehoseFailures/!{firehose:error-output-type}/`,
        // The first buffer condition that is satisfied triggers Kinesis Data Firehose to deliver the data
        bufferingHints: {
          intervalInSeconds: 120, // min 60s max 900s as of 30/09/21
          sizeInMBs: 10, // min 1 max 128 as of 30/09/21
        },
        compressionFormat: 'UNCOMPRESSED',
        roleArn: this.role.roleArn,
        encryptionConfiguration: {
          kmsEncryptionConfig: {
            awskmsKeyArn: Alias.fromAliasName(this, 'AwsManagedKey', 'alias/aws/s3').keyArn,
          },
        },
        cloudWatchLoggingOptions: {
          enabled: true,
          logGroupName: logGroup.logGroupName,
          logStreamName: logStream.logStreamName,
        },
      },
    });

    // Create a crawler which will read the source data from s3 and populate one or more tables
    const startTablePrefix = `${this.dataProductUniqueIdentifier}-start`;
    const crawler = new Crawler(this, 'StartCrawler', {
      targetGlueDatabase: glueDatabase,
      targetDescription: {
        s3Target: {
          bucket: dataBucket.bucketName,
          key: this.dataBucketFirehoseOutputPrefix,
        } as S3Location,
      },
      tablePrefix: startTablePrefix,
      glueSecurityConfigurationName,
      sourceAccessRole: this.role,
    });

    const { executeCrawler, getCrawledTableDetails } = this.buildExecuteCrawlerAndDiscoverCrawledTableSteps(crawler);

    const waitX = new Wait(this, 'Wait 10 Seconds', {
      time: WaitTime.duration(Duration.seconds(10)),
    });

    const isS3CheckSuccess = new tasks.LambdaInvoke(this, 'CheckS3notEmpty', {
      lambdaFunction: validateS3PathLambda,
      payload: TaskInput.fromObject({
        Payload: {
          bucketName: dataBucket.bucketName,
          key: this.dataBucketFirehoseOutputPrefix,
          attempts: TaskInput.fromJsonPathAt('$.Payload.attempts').value,
        },
      }),
      retryOnServiceExceptions: false,
    });

    // Execute the crawler on the source data, and retrieve the crawled table details and apply transforms
    // on all discovered tables
    const startAttempts = new Pass(this, 'StartAttemptsCounter', {
      parameters: {
        Payload: {
          attempts: 0,
        },
      },
    });

    const prepareError = new Pass(this, 'PrepareNotifyError', {
      parameters: {
        ErrorDetails: {
          Error:
            'No data was found on the stream after 5 minutes. Please ensure data is sent on the stream, then trigger a data update.',
        },
      },
    });

    const iterator = new Pass(this, 'StartS3PathValidation');
    const definition = startAttempts
      .next(iterator)
      .next(isS3CheckSuccess)
      .next(
        new Choice(this, 'S3ExistsAndNotempty?')
          .when(
            Condition.booleanEquals('$.Payload.hasContents', true),
            executeCrawler.next(
              new Choice(this, 'VerifyCrawlerStepFunctionOutput')
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
                .otherwise(
                  getCrawledTableDetails.next(this.transformLoop.executeAllTransformsAndCompleteStateMachine()),
                ),
            ),
          )
          .when(
            Condition.numberGreaterThan('$.Payload.attempts', 30),
            prepareError.next(this.putErrorEventOnEventBridge),
          )
          .otherwise(waitX.next(iterator)),
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

  protected createAutomaticDataUpdateTriggerRule(_props: DynamicInfraStackProps): Rule {
    const { dataBucket } = this.staticInfrastructureReferences;

    // to enable cloud trail in the source bucket (to allow EventBridge events)
    const trail = new Trail(this, 'CloudTrail');
    trail.addS3EventSelector([
      {
        bucket: dataBucket,
        objectPrefix: this.dataBucketFirehoseOutputPrefix,
      },
    ]);

    // s3 events are coming from the default bus
    return new Rule(this, 'DataProductKinesisRule', {
      description: 'Rule matching kinesis stream events',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventName: ['PutObject', 'CompleteMultipartUpload'],
          requestParameters: {
            bucketName: [dataBucket.bucketName],
            key: [{ prefix: this.dataBucketFirehoseOutputPrefix }],
          },
        },
      },
    });
  }
}

export default KinesisSourceStack;
