/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsStepFunctionsInstance } from '@ada/aws-sdk';
import { CallingUser, DataProductDataStatus } from '@ada/common';
import { DataProductEventDetailTypes, EventSource } from '@ada/microservice-common';
import { DataProductIdentifier } from '@ada/api-client';
import { DataProductStore } from '../../../components/ddb/data-product';
import { LockClient } from '../../../../api/components/entity/locks/client';
import { Logger } from '@ada/infra-common/constructs/lambda/lambda-logger';
import { NotificationClient } from '../../../../api/components/notification/client';
import { entityIdentifier } from '@ada/api-client/types';

export interface StartDataImportInput {
  readonly stateMachineArn: string;
  readonly dataProductIdentifier: DataProductIdentifier;
  readonly callingUser: CallingUser;
}

const sfn = AwsStepFunctionsInstance();

/**
 * Handler triggered by event bridge to start the data import for a data product
 */
export const handler = async (event: StartDataImportInput, context: any): Promise<void> => {
  const log = Logger.getLogger({
    lambda: {
      event,
      context,
    },
  });
  const {
    stateMachineArn,
    dataProductIdentifier: { domainId, dataProductId },
    callingUser,
  } = event;
  log.info(`Received start data import request for ${domainId}.${dataProductId}`);

  // Get the latest execution (if any)
  const latestExecution = (
    await sfn
      .listExecutions({
        stateMachineArn,
        maxResults: 1,
      })
      .promise()
  ).executions[0];

  // Define a utility method to notify failure to start import
  const notifyFailure = (message: string) =>
    NotificationClient.getInstance().send({
      source: EventSource.DATA_PRODUCTS,
      type: DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_START_FAILED,
      payload: {
        domainId,
        dataProductId,
        message,
      },
      target: callingUser.userId,
    });

  // If there's a latest execution and it's in progress, we cannot currently serve the new import job
  if (latestExecution?.status === 'RUNNING') {
    log.warn(`Import already running for ${domainId}.${dataProductId}, cannot start another import yet.`);
    await notifyFailure(
      `Import could not be started since one is already running for data product ${domainId}.${dataProductId}. Please consider recreating the data product with a lower update frequency to accommodate import time.`,
    );
    return;
  }

  // Mark the data product as updating when it starts!
  const lockClient = LockClient.getInstance('StartDataImport');
  await lockClient.acquire(entityIdentifier('DataProductDomainDataProduct', { domainId, dataProductId }));
  const store = DataProductStore.getInstance();
  const dataProduct = await store.getDataProduct(domainId, dataProductId);
  if (!dataProduct) {
    log.error(`Import failed because no data product found in the store ${domainId}.${dataProductId}`);
    await notifyFailure(
      `Import could not be started since the data product ${domainId}.${dataProductId} does not exist.`,
    );
    return;
  }
  await store.putDataProduct(domainId, dataProductId, callingUser.userId, {
    ...dataProduct,
    dataStatus: DataProductDataStatus.UPDATING,
  });
  await lockClient.releaseAll();

  // We're clear to start the import
  await sfn
    .startExecution({
      stateMachineArn,
    })
    .promise();
  log.info(`Started data import state machine for ${domainId}.${dataProductId}`);
};
