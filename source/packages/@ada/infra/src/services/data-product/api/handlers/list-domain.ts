/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse, getPaginationParameters } from '@ada/api-gateway';
import { DomainStore } from '../../components/ddb/domain';

/**
 * Handler for listing domains
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('listDataProductDomains', async ({ requestParameters }) => {
  const paginationParameters = getPaginationParameters(requestParameters);

  const response = await DomainStore.getInstance().listDomains(paginationParameters);
  if (response.error) {
    return ApiResponse.badRequest({ message: response.error });
  }
  return ApiResponse.success(response);
});
