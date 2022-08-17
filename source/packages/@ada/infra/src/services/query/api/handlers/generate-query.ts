/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/api-client-lambda';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import {
  applyGovernanceToDataSets,
  getReferencedQueriesAndDataSets,
  rewriteQuery,
} from '../../components/generate-query';

/**
 * Handler for generating a rendered query
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'postQueryGenerate',
  async ({ body: { query } }, callingUser, _event, { log }) => {
    const api = ApiClient.create(callingUser);

    const { dataProductIdentifiers, dataSets, dataProducts, queries } = await getReferencedQueriesAndDataSets(
      api,
      query,
      callingUser,
    );

    // Apply governance to the data sets
    const governedDataSets = await applyGovernanceToDataSets(api, dataProductIdentifiers, dataSets, callingUser);
    log.info(`Governed data sets : ${JSON.stringify(governedDataSets)}`);

    // Call Query Parse/Render Service /rewrite to render back to SQL query
    const rewrittenQuery = await rewriteQuery(api, query, queries, governedDataSets, callingUser);
    log.info(`Governed query ${rewrittenQuery.query}`);

    return ApiResponse.success({
      query: rewrittenQuery.query,
      governedDataSets,
      dataProducts,
    });
  },
);
