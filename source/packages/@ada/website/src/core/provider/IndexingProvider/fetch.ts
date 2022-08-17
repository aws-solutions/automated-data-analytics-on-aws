/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ExtendedRefetch, apiHooks } from '$api';
import { throttle } from 'lodash';
import { useAllDataProducts } from '$views/data-product/hooks';
import { useEffect, useMemo, useState } from 'react';
import { useStatefulRef } from '$common/hooks';
import { useUserId } from '$core/provider/UserProvider';

type FetchIndexTuple = [CallableFunction | null, ExtendedRefetch<any>];

// TODO: makes sure this refetch stale data
export const useFetchIndex = (refetchInterval?: number) => {
  // TODO: rework "enabled" to toggle with fetch
  const [enabled, setEnabled] = useState(false);
  // fetches all data products and all domains
  const [, , batchDataProductsInfo] = useAllDataProducts({
    enabled,
  });

  const userId = useUserId();

  const fetchListRef = useStatefulRef(
    batchDataProductsInfo
      .map((queryInfo) => [null, queryInfo.refetch] as FetchIndexTuple)
      .concat(
        ...[
          apiHooks.useLazyAllIdentityGroups(),
          apiHooks.useLazyAllIdentityGroups(),
          apiHooks.useLazyAllOntologies(),
          apiHooks.useLazyAllQuerySavedQueries(),
          apiHooks.useLazyAllQueryNamespaceSavedQueries({ namespace: userId }),
        ].map(([lazyInvoke, , queryInfo]) => {
          return [[lazyInvoke, queryInfo.refetch]] as [FetchIndexTuple];
        }),
      ) as unknown as FetchIndexTuple[],
  );

  const fetch = useMemo(() => {
    return throttle(() => {
      try {
        if (enabled) {
          fetchListRef.current?.forEach(([, refetch]) => {
            refetch({ force: true });
          });
        } else {
          setEnabled(true);
          fetchListRef.current?.forEach(([invoke]) => {
            if (typeof invoke === 'function') {
              invoke();
            }
          });
        }
      } catch (error) {
        console.warn('Failed to fetch search data', error);
      }
    }, 10000); // fetch at most every 10 seconds
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (refetchInterval && refetchInterval > 0) {
      const interval = setInterval(() => {
        fetch();
      }, refetchInterval);

      return () => {
        clearInterval(interval);
      };
    }
    return undefined;
  }, [refetchInterval, fetch]);

  return fetch;
};
