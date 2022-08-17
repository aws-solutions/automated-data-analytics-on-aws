/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CachedGeneratedQueryWithCreateAndUpdateDetails, CachedQueryStore } from '../../ddb/cached-query';

import { DefaultUser, StepFunctionLambdaEvent } from '@ada/microservice-common';

/**
 * Handler used to write item in the cache
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = async (
  event: StepFunctionLambdaEvent<CachedGeneratedQueryWithCreateAndUpdateDetails>,
  _context: any,
): Promise<CachedGeneratedQueryWithCreateAndUpdateDetails> => {
  const { query, cacheId, queryExecutionId, athenaStatus, updatedTimestamp } = event.Payload;

  const result = await CachedQueryStore.getInstance().putCachedGeneratedQuery(cacheId, DefaultUser.SYSTEM, {
    cacheId,
    query,
    queryExecutionId,
    athenaStatus,
    updatedTimestamp,
  });

  return {
    ...event.Payload,
    ...result,
  };
};
