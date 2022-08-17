/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/infra-common/constructs/api/lambda-layer/code/nodejs/api-client-lambda';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AwsStepFunctionsInstance } from '@ada/aws-sdk';
import { DataProductSourceDataStatus } from '@ada/common';
import { DataProductStore } from '../../components/ddb/data-product';
import { applyGovernanceToDataSets } from '../../../query/components/generate-query';
import { isPermittedForReadAccessByDataProductPolicy } from '@ada/microservice-common';

const sfn = AwsStepFunctionsInstance();

/**
 * Handler for getting a data product by dataProductId
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'getDataProductDomainDataProduct',
  async ({ requestParameters }, callingUser) => {
    const { dataProductId, domainId } = requestParameters;

    const dataProduct = await DataProductStore.getInstance().getDataProduct(domainId, dataProductId);

    if (!dataProduct) {
      return ApiResponse.notFound({
        message: `Not Found: no dataProduct was found with dataProductId ${dataProductId}`,
      });
    }

    const api = ApiClient.create(callingUser);

    // Check whether the user has read access to the data product
    const dataProductPolicy = await api.getGovernancePolicyDomainDataProduct({ domainId, dataProductId });
    if (!isPermittedForReadAccessByDataProductPolicy(dataProductPolicy, callingUser)) {
      return ApiResponse.forbidden({
        message: `Read access is required to retrieve data product ${domainId}.${dataProductId}`,
      });
    }

    // Compute the governance for the calling user to include this information in the response
    const governedDataSets = await applyGovernanceToDataSets(
      api,
      [dataProduct],
      Object.entries(dataProduct.dataSets).map(([dataSetId, dataSet]) => ({
        domainId,
        dataProductId,
        dataSetId,
        addressedAs: `${domainId}.${dataProductId}.${dataSetId}`,
        dataSet,
      })),
      callingUser,
    );

    // If the data product is still importing, double check the status by querying the state machine, just in case the
    // state machine exited with an unexpected error and failed to send the failure event
    if (dataProduct.dataStatus === DataProductSourceDataStatus.UPDATING && dataProduct.dataImportStateMachineArn) {
      // Get the latest data import execution
      const latestExecution = (
        await sfn
          .listExecutions({
            stateMachineArn: dataProduct.dataImportStateMachineArn,
            maxResults: 1,
          })
          .promise()
      ).executions[0];

      // If there's a latest execution and it's in a failed state, reflect this in the response
      if (new Set(['FAILED', 'TIMED_OUT', 'ABORTED']).has(latestExecution?.status)) {
        dataProduct.dataStatus = DataProductSourceDataStatus.FAILED;
        dataProduct.dataStatusDetails = `Import state machine failed with status ${latestExecution.status}`;
      }
    }

    return ApiResponse.success({
      ...dataProduct,
      dataSets: Object.fromEntries(governedDataSets.map(({ dataSetId, dataSet }) => [dataSetId, dataSet])),
    });
  },
);
