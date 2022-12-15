/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CachedGeneratedQuery, CachedQueryStore } from '../../ddb/cached-query';
import { CallingUser, computeUniqueHash } from '@ada/common';
import { Query } from '@ada/api';
import { StepFunctionLambdaEvent } from '@ada/microservice-common';
import { getLastUpdatedDataProductDate } from '../../generate-query';

export interface GetCachedQueryInput extends Query {
  originalQuery?: string;
  callingUser: CallingUser;
}

export interface GetCachedQueryResult extends CachedGeneratedQuery {
  expired: boolean;
}

/**
 * Handler used to get item from the cache (if exists)
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = async (
  event: StepFunctionLambdaEvent<GetCachedQueryInput>,
  _context: unknown,
): Promise<GetCachedQueryResult> => {
  const { query, originalQuery, callingUser } = event.Payload;
  const cacheId = computeUniqueHash(query);
  const cachedQuery = await CachedQueryStore.getInstance().getCachedGeneratedQuery(cacheId);
  let expired: boolean = cachedQuery === undefined || !originalQuery;

  // if is not already expired (eg. not existing yet)
  // verify whether the data product have been updated after the cache has been created
  if (!expired) {
    const latestDataUpdateTimestamp = await getLastUpdatedDataProductDate(callingUser, originalQuery ?? '');

    expired =
      latestDataUpdateTimestamp !== undefined && latestDataUpdateTimestamp > (cachedQuery?.updatedTimestamp ?? 0);
  }

  return {
    ...event.Payload,
    ...(cachedQuery || {}),
    expired,
    cacheId,
  };
};
