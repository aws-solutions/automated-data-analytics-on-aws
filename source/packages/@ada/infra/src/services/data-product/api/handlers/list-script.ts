/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse, getPaginationParameters } from '@ada/api-gateway';
import { ScriptStore } from '../../components/ddb/script';

/**
 * Handler for listing scripts
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('listDataProductScripts', async ({ requestParameters }) => {
  const paginationParameters = getPaginationParameters(requestParameters);

  const response = await ScriptStore.getInstance().listScripts(paginationParameters);
  if (response.error) {
    return ApiResponse.badRequest({ message: response.error });
  }
  return ApiResponse.success(response);
});
