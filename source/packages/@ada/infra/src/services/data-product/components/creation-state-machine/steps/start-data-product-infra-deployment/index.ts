/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CheckDataProductInfraDeploymentStatusEvent, StartDataProductInfraDeploymentEvent } from '../types';
import { DataProductStore } from '../../../ddb/data-product';
import { LockClient } from '../../../../../api/components/entity/locks/client';
import { StepFunctionLambdaEvent } from '../../../../../../common/services';
import { entityIdentifier } from '@ada/api-client/types';
import { startDataProductInfraDeployment } from '../../../../dynamic-infrastructure/cdk';

// NB: since this is lambda and not construct, connector infra must be registed explicitly
import '@ada/connectors/register-infra';
import { Connectors } from '@ada/connectors';

console.debug('CONNECTORS:', Connectors);

/**
 * Start the deployment of dynamic data product infrastructure
 * @param event initial payload of step function execution
 * @param context lambda context
 */
export const handler = async (
  event: StepFunctionLambdaEvent<StartDataProductInfraDeploymentEvent>,
  _context: any,
): Promise<CheckDataProductInfraDeploymentStatusEvent> => {
  const { dataProduct, callingUser } = event.Payload;
  const dataProductIdentifier = { domainId: dataProduct.domainId, dataProductId: dataProduct.dataProductId };
  const cloudFormationStackId = await startDataProductInfraDeployment(dataProduct, callingUser);

  const lockClient = LockClient.getInstance('startDataProductInfraDeployment');

  await lockClient.acquire(entityIdentifier('DataProductDomainDataProduct', dataProductIdentifier));

  const existingDataProduct = (await DataProductStore.getInstance().getDataProduct(
    dataProduct.domainId,
    dataProduct.dataProductId,
  ))!;

  await DataProductStore.getInstance().putDataProduct(
    dataProduct.domainId,
    dataProduct.dataProductId,
    callingUser.userId,
    {
      ...existingDataProduct,
      cloudFormationStackId,
    },
  );

  await lockClient.releaseAll();

  return {
    ...event.Payload,
    cloudFormationStackId,
  };
};
