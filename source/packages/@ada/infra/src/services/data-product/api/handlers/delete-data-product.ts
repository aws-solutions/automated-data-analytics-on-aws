/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/api-client-lambda';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AwsCloudFormationInstance, AwsSecretsManagerInstance, AwsStepFunctionsInstance } from '@ada/aws-sdk';
import { DataProduct } from '@ada/api';
import { DataProductDataStatus, DataProductInfrastructureStatus } from '@ada/common';
import { DataProductStore } from '../../components/ddb/data-product';
import { METRICS_EVENT_TYPE, OperationalMetricsClient } from '@ada/services/api/components/operational-metrics/client';
import { entityIdentifier } from '@ada/api-client/types';
import { filterRelatedEntitiesOfType } from '../../../api/components/entity/relationships/client';
import { getSourceDetailsSecretProperty, requireSecret } from '../../components/secrets-manager/data-product';
import { isPermittedForFullAccessByDataProductPolicy } from '@ada/microservice-common';

const cfn = AwsCloudFormationInstance();
const secrets = AwsSecretsManagerInstance();
const sfn = AwsStepFunctionsInstance();

const getDataProductDataUpdatingStatus = async (dataProduct: DataProduct) => {
  if (dataProduct.dataImportStateMachineArn) {
    const executions = await sfn
      .listExecutions({
        stateMachineArn: dataProduct.dataImportStateMachineArn,
        maxResults: 1,
      })
      .promise();

    const latestExecution =
      executions.executions.length > 0 ? executions.executions[executions.executions.length - 1] : null;

    if (latestExecution && new Set(['FAILED', 'TIMED_OUT', 'ABORTED']).has(latestExecution.status)) {
      return DataProductDataStatus.FAILED;
    }
  }

  return dataProduct.dataStatus;
};

/**
 * Handler for deleting a data product
 */
export const handler = ApiLambdaHandler.for(
  'deleteDataProductDomainDataProduct',
  async ({ requestParameters }, callingUser, _event, { relationshipClient, lockClient, log }) => {
    const { domainId, dataProductId } = requestParameters;
    const { userId } = callingUser;
    const dataProductIdentifier = { domainId, dataProductId };
    log.info(`dataProductIdentifier : ${dataProductIdentifier}`);
    const dataProductStore = DataProductStore.getInstance();

    const dataProduct = await dataProductStore.getDataProduct(domainId, dataProductId);

    if (!dataProduct) {
      return ApiResponse.notFound({
        message: `No data product found in domain ${domainId} with id ${dataProductId}`,
      });
    }

    const api = ApiClient.create(callingUser);
    const policy = await api.getGovernancePolicyDomainDataProduct({
      domainId,
      dataProductId,
    });
    log.info(`Governance Policy : ${policy}`);

    if (policy && !isPermittedForFullAccessByDataProductPolicy(policy, callingUser)) {
      return ApiResponse.forbidden({
        message: `Not authorized to delete data product ${domainId}.${dataProductId}`,
      });
    }

    if (dataProduct.dataStatus === DataProductDataStatus.UPDATING) {
      // Add extra logic to handle pre-existing issue where existing data products (created before GA 1.1) cannot be removed if it's in a importing failed state.
      // The cause of the issue has been fixed in GA 1.1.
      const status = await getDataProductDataUpdatingStatus(dataProduct);
      if (status === DataProductDataStatus.UPDATING) {
        return ApiResponse.badRequest({
          message: `${domainId}.${dataProductId} is currently importing data and cannot be deleted`,
        });
      }
    }

    if (dataProduct.infrastructureStatus === DataProductInfrastructureStatus.PROVISIONING) {
      return ApiResponse.badRequest({
        message: `${domainId}.${dataProductId} is currently being built and cannot be deleted`,
      });
    }

    if (dataProduct.childDataProducts.length > 0) {
      const dataProductNames = dataProduct.childDataProducts
        .map(({ domainId, dataProductId }) => `${domainId}.${dataProductId}`) //NOSONAR (S1117:Shadow Vars) - wont' fix
        .join(', ');
      return ApiResponse.badRequest({
        message: `Cannot delete this data product as it is referenced by the following data products: ${dataProductNames}`,
      });
    }

    const dataProductEntity = entityIdentifier('DataProductDomainDataProduct', dataProductIdentifier);
    const relatedEntities = await relationshipClient.getRelatedEntities(dataProductEntity);

    const relatedSavedQueries = filterRelatedEntitiesOfType(relatedEntities, 'QuerySavedQuery');
    if (relatedSavedQueries.length > 0) {
      const relatedSaveQueriesStr = relatedSavedQueries
        .map(({ namespace, queryId }) => `${namespace}.${queryId}`)
        .join(', ');
      return ApiResponse.badRequest({
        message: `Cannot delete this data product as it is referenced by the following saved queries: ${relatedSaveQueriesStr}`,
      });
    }

    // Each of the parent data products must be updated to remove this one as a child
    const parentLocks = await lockClient.acquire(
      ...dataProduct.parentDataProducts.map((parent) => entityIdentifier('DataProductDomainDataProduct', parent)),
    );
    await Promise.all(
      dataProduct.parentDataProducts.map(async (parent) => {
        const parentDataProduct = (await dataProductStore.getDataProduct(parent.domainId, parent.dataProductId))!;
        await dataProductStore.putDataProduct(parent.domainId, parent.dataProductId, userId, {
          ...parentDataProduct,
          childDataProducts: parentDataProduct.childDataProducts.filter(
            (child) => !(child.domainId === domainId && child.dataProductId === dataProductId),
          ),
        });
      }),
    );
    await lockClient.release(...parentLocks);
    log.debug(`Released all parent locks. ${parentLocks}`);

    const relatedDataProductPolicies = filterRelatedEntitiesOfType(
      relatedEntities,
      'GovernancePolicyDomainDataProduct',
    );
    const relatedDefaultLensPolicies = filterRelatedEntitiesOfType(
      relatedEntities,
      'GovernancePolicyDefaultLensDomainDataProduct',
    );
    log.info(`relatedDataProductPolicies: ${relatedDataProductPolicies}`);
    log.info(`relatedDefaultLensPolicies: ${relatedDefaultLensPolicies}`);

    await Promise.all<any>([
      // Delete the data product in dynamodb
      dataProductStore.deleteDataProductIfExists(domainId, dataProductId),
      // Delete the data product secret (if any)
      ...[
        requireSecret(dataProduct)
          ? (() => {
              const secretsToDestroy = [];

              for (const secret of getSourceDetailsSecretProperty(dataProduct)) {
                secretsToDestroy.push(
                  secrets
                    .deleteSecret({
                      SecretId: secret as string,
                      ForceDeleteWithoutRecovery: true,
                    })
                    .promise(),
                );
              }

              log.info(`secretsToDestroy: ${secretsToDestroy}`);
              return secretsToDestroy;
            })()
          : [],
      ],
      // Start deletion of data product infrastructure
      // Ensure cfn stack was actually created before attempting to delete. Rare cases can cause build to
      // fail prior to creating the cfn stack and the UI delete action reports an error at this step in deletion.
      // NOTE: Consider providing a way to track data product deletion and surface failures etc in the UI. For now, must look at cfn console.
      dataProduct.cloudFormationStackId
        ? cfn.deleteStack({ StackName: dataProduct.cloudFormationStackId }).promise()
        : Promise.resolve('Stack does not exist for data product'),
      // Delete the data product policy
      ...relatedDataProductPolicies.map((_policy) => api.deleteGovernancePolicyDomainDataProduct(_policy)),
      // Delete the default lens policy (if any)
      ...relatedDefaultLensPolicies.map((_policy) => api.deleteGovernancePolicyDefaultLensDomainDataProduct(_policy)),
      // Delete all relationships to this data product
      relationshipClient.removeAllRelationships(dataProductEntity),
    ]);
    log.info(`Deleted data product with id: ${dataProductIdentifier}`);

    await OperationalMetricsClient.getInstance().send({
      event: METRICS_EVENT_TYPE.DATA_PRODUCTS_DELETED,
      connector: dataProduct.sourceType,
    });

    return ApiResponse.success(dataProduct);
  },
);
