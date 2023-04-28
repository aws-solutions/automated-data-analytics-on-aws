/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CheckDataProductInfraDeploymentStatusEvent } from './types';
import {
  DATA_PRODUCT_DATA_IMPORT_STATE_MACHINE_STACK_OUTPUT_PREFIX,
  DataProductInfrastructureStatus,
} from '@ada/common';
import { DataProductEventDetailTypes, EventSource, StepFunctionLambdaEvent } from '@ada/microservice-common';
import { DataProductStore } from '../../ddb/data-product';
import { LockClient } from '../../../../api/components/entity/locks/client';
import { Logger } from '@ada/infra-common/constructs/lambda/lambda-logger';
import { NotificationClient } from '../../../../api/components/notification/client';
import { describeStack } from '../../../dynamic-infrastructure/cdk';
import { entityIdentifier } from '@ada/api-client/types';
import { triggerDataProductDataUpdate } from '../../../dynamic-infrastructure/events';

const log = Logger.getLogger({ tags: ['DataProductInfraDeploymentComplete'] });

/**
 * Handler called once creation of the dynamic infrastructure for a data product is complete.
 * Data product infrastructure could have created successfully, or failed to create.
 * @param event state machine state after deployment complete
 * @param context lambda context
 */
export const handler = async (
  event: StepFunctionLambdaEvent<CheckDataProductInfraDeploymentStatusEvent>,
  _context: any,
): Promise<void> => {
  const {
    cloudFormationStackId,
    dataProduct,
    callingUser: { userId },
  } = event.Payload;

  const { domainId, dataProductId } = dataProduct;

  const stack = await describeStack(cloudFormationStackId);
  log.info('Completed deployment of stack', { stack, cloudFormationStackId });

  // Lock the data product before updating
  const lockClient = LockClient.getInstance('dataProductInfraDeploymentComplete');
  await lockClient.acquire(
    entityIdentifier('DataProductDomainDataProduct', {
      domainId,
      dataProductId,
    }),
  );

  const dataProductStore = DataProductStore.getInstance();
  const existingDataProduct = (await dataProductStore.getDataProduct(dataProduct.domainId, dataProduct.dataProductId))!;

  const isInfrastructureCreatedSuccessfully = stack.StackStatus === 'CREATE_COMPLETE';

  // Get the stack's state machine arn if available
  const dataImportStateMachineArn = (stack.Outputs || []).find((output) =>
    output.ExportName?.startsWith(DATA_PRODUCT_DATA_IMPORT_STATE_MACHINE_STACK_OUTPUT_PREFIX),
  )?.OutputValue;

  const updatedDataProduct = await dataProductStore.putDataProduct(
    dataProduct.domainId,
    dataProduct.dataProductId,
    userId,
    {
      ...existingDataProduct,
      dataImportStateMachineArn,
      ...(isInfrastructureCreatedSuccessfully
        ? {
            infrastructureStatus: DataProductInfrastructureStatus.READY,
            infrastructureStatusDetails: 'Infrastructure created successfully',
          }
        : {
            infrastructureStatus: DataProductInfrastructureStatus.FAILED,
            infrastructureStatusDetails:
              stack.StackStatusReason ||
              `Infrastructure for data product failed to create, with status: ${stack.StackStatus}`,
          }),
    },
  );

  if (isInfrastructureCreatedSuccessfully) {
    // Start an initial data update now that the infrastructure has been created
    await triggerDataProductDataUpdate(dataProduct.domainId, dataProduct.dataProductId, userId);
  } else {
    log.error('Stack failed to deploy.', { stack, cloudFormationStackId });
    await NotificationClient.getInstance().send({
      target: userId,
      source: EventSource.DATA_PRODUCTS,
      type: DataProductEventDetailTypes.DATA_PRODUCT_BUILD_ERROR,
      payload: {
        dataProduct: updatedDataProduct,
      },
    });
  }
  await lockClient.releaseAll();
};