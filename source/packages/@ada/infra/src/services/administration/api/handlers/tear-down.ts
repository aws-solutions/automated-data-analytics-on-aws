/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiResponse } from '@ada/api-gateway';
import {
  AwsCloudFormationInstance,
  AwsCloudWatchLogsInstance,
  AwsKMSInstance,
  AwsLambdaInstance,
  AwsS3Instance,
} from '@ada/aws-sdk';
import { DataProductStore } from '../../../data-product/components/ddb/data-product';
import { InvocationType } from 'aws-cdk-lib/triggers';
import { Logger } from '@ada/infra-common/constructs/lambda/lambda-logger';
import { TearDownDetails } from '@ada/api-client';
import { TearDownLambdaEvent, TearDownMode, TeardownEnvironmentVars } from './types';
import { VError } from 'verror';
import { parse as parseArn } from '@aws-sdk/util-arn-parser';
import chunk from 'lodash/chunk';

const lambda = AwsLambdaInstance();
const s3 = AwsS3Instance();
const cfn = AwsCloudFormationInstance();
const kms = AwsKMSInstance();
const cloudwatchLogs = AwsCloudWatchLogsInstance();

const log = Logger.getLogger();

const { CORE_STACK_ID, TEAR_DOWN_LAMBDA_ARN } = process.env as unknown as TeardownEnvironmentVars;

const getRetainedResourceArns = (): string[] => {
  const { RETAINED_RESOURCES } = process.env as unknown as TeardownEnvironmentVars;
  log.info('getRetainedResourceArns: ' + RETAINED_RESOURCES);
  return JSON.parse(RETAINED_RESOURCES);
};

// The number of data product cloudformation stacks to start deletion of in parallel
const DATA_PRODUCT_START_DESTROY_BATCH_SIZE = 10;

/**
 * Starts the tear down by invoking the tear down lambda
 */
export const startTearDown = async (event: TearDownLambdaEvent): Promise<ApiResponse<TearDownDetails>> => {
  // Trigger the tear down asynchronously
  await lambda
    .invoke({
      FunctionName: TEAR_DOWN_LAMBDA_ARN,
      Payload: JSON.stringify(event),
      InvocationType: InvocationType.EVENT,
    })
    .promise();

  // Respond to indicate the teardown has started.
  return ApiResponse.success({
    coreStackId: CORE_STACK_ID,
    mode: event.mode,
    message: `Started full tear down with mode ${event.mode}. Please monitor progress in the cloudformation console.`,
    retainedResources: getRetainedResourceArns(),
  });
};

/**
 * Empty an s3 bucket of its contents. Shamelessly borrowed from CDK:
 * https://github.com/aws/aws-cdk/blob/v1.125.0/packages/@aws-cdk/aws-s3/lib/auto-delete-objects-handler/index.ts#L36
 * @param bucketName the bucket to empty
 */
const emptyBucket = async (bucketName: string) => {
  log.info('Emptying bucket', { bucketName });
  const listedObjects = await s3.listObjectVersions({ Bucket: bucketName }).promise();
  const contents = [...(listedObjects.Versions || []), ...(listedObjects.DeleteMarkers || [])];
  if (contents.length === 0) {
    return;
  }

  const records = contents.map((record: any) => ({ Key: record.Key, VersionId: record.VersionId }));
  await s3.deleteObjects({ Bucket: bucketName, Delete: { Objects: records } }).promise();

  if (listedObjects?.IsTruncated) {
    await emptyBucket(bucketName);
  }
};

/**
 * Empty an s3 bucket of all of its objects and then delete the bucket
 * @param bucketName the bucket to destroy
 */
const destroyBucket = async (bucketName: string) => {
  log.info('Destroying bucket', { bucketName });
  await emptyBucket(bucketName);

  log.info('Deleting bucket', { bucketName });
  await s3
    .deleteBucket({
      Bucket: bucketName,
    })
    .promise();
};

async function deleteKmsKey(keyId: string) {
  log.info('Deleting KMS key', { keyId });
  await kms
    .disableKey({
      KeyId: keyId,
    })
    .promise();
  await kms
    .scheduleKeyDeletion({
      KeyId: keyId,
    })
    .promise();
}

async function deleteKmsKeyAlias(aliasName: string) {
  log.info('Deleting KMS key Alias', { aliasName });
  await kms
    .deleteAlias({
      AliasName: aliasName,
    })
    .promise();
}

async function deleteLogStream(logGroupName: string, logStreamName: string) {
  log.info('Deleting Log Stream', { logGroupName, logStreamName });
  await cloudwatchLogs
    .deleteLogStream({
      logGroupName,
      logStreamName,
    })
    .promise();
}

/**
 * Tear down the entire application, optionally also tearing down all managed data.
 */
/* eslint-disable sonarjs/cognitive-complexity */
export const handler = async (event: TearDownLambdaEvent, _context: any) => { //NOSONAR (S3776:Cognitive Complexity) - won't fix
  log.info('Starting tear down', { event });

  // Delete all infrastructure for data products. Note that we do not call the delete data product api since we do
  // not need to worry about checking for dependencies etc as the system does not need to remain functional.
  const allDataProductsWithInfrastructure = (await DataProductStore.getInstance().listAllDataProducts()).filter(
    (dataProduct) => dataProduct.cloudFormationStackId,
  );

  for (const dataProductBatch of chunk(allDataProductsWithInfrastructure, DATA_PRODUCT_START_DESTROY_BATCH_SIZE)) {
    const batch = dataProductBatch.map(({ domainId, dataProductId }) => `${domainId}.${dataProductId}`);
    log.info(`Deleting data product infrastructure for: ${batch}`);
    await Promise.all(
      dataProductBatch.map(async ({ domainId, dataProductId, cloudFormationStackId }) => {
        const stackResponse = await cfn
          .describeStacks({
            StackName: cloudFormationStackId as string,
          })
          .promise();
        if (stackResponse.Stacks?.length === 1 && !stackResponse.Stacks[0].StackStatus.includes('IN_PROGRESS')) {
          await cfn
            .deleteStack({
              StackName: cloudFormationStackId as string,
            })
            .promise();
          log.info(`Successfully deleted stack ${cloudFormationStackId as string}`);
        } else {
          log.warn(
            `Not deleting data product ${domainId}.${dataProductId} because the stack either does not exist or is currently updating.`,
            { stackResponse },
          );
        }
      }),
    );
  }

  // List of arns stored in parameter to maintain list of resources that are retained
  const retainedResourceArns = getRetainedResourceArns();
  log.info('Retained resources', { retainedResourceArns });

  // Next, delete all resource that are retained by the solution
  try {
    if (event.mode === TearDownMode.DESTROY_DATA) {
      await Promise.all(
        retainedResourceArns.map((arnString) => {
          try {
            const arn = parseArn(arnString);
            log.info(`Deleting retained resources: ${arnString}`, { arn });
            switch (arn.service) {
              case 's3': {
                return destroyBucket(arn.resource);
              }
              case 'kms': {
                const [type, id] = arn.resource.split('/');
                if (type === 'key') {
                  return deleteKmsKey(id);
                }
                if (type === 'alias') {
                  return deleteKmsKeyAlias(id);
                }
                log.warn(`Unhandled retained resources: ${arn.service}:::${arn.resource}`, { arn });
                return;
              }
              case 'logs': {
                // https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazoncloudwatchlogs.html#amazoncloudwatchlogs-resources-for-iam-policies
                // arn:${Partition}:logs:${Region}:${Account}:log-group:${LogGroupName}:log-stream:${LogStreamName}
                // arn:${Partition}:logs:${Region}:${Account}:log-group:${LogGroupName}
                // arn:${Partition}:logs:${Region}:${Account}:destination:${DestinationName}
                const [type, logGroupName, logStreamType, logStreamName] = arn.resource.split(':');
                if (type === 'log-group' && logStreamType === 'log-stream') {
                  return deleteLogStream(logGroupName, logStreamName);
                } else {
                  log.warn(`Unhandled retained resources: ${arn.service}:::${arn.resource}`, { arn });
                  return;
                }
              }
              default: {
                log.warn(`Unhandled retained resources: ${arn.service}:::${arn.resource}`, { arn });
                return;
              }
            }
          } catch (error: any) {
            log.error(new VError(error, `Failed to delete retained resource: ${arnString}`));
            return;
          }
        }),
      );
    }
  } catch (error: any) {
    // Ignore errors with deleting retained resources to prevent from actually tearing down
    // the solution.
    log.error(error);
  }

  // Finally, we delete the core ada stack.
  // Be careful! After this point, even the lambda executing this very line of code will be destroyed, so this should
  // be the last thing we do!
  log.info('Deleting core stack', { CORE_STACK_ID });
  const response = await cfn.deleteStack({ StackName: CORE_STACK_ID }).promise();
  log.info('Delete core stack response: ', { response });
};
/* eslint-enable sonarjs/cognitive-complexity */
