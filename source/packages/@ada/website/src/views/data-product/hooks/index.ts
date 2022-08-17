/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as POLLING from '$config/polling';
import { DataProduct, DataProductEntity, DataProductIdentifier, GovernedDataProductEntity } from '@ada/api';
import { DataProductState, getDataProductState } from '../common';
import { ExtendedUseQueryResult, apiHooks } from '$api';
import { RefObject, useCallback, useEffect, useMemo, useState } from 'react';
import { UseQueryResult } from 'react-query';
import { getDataProductSQLIdentitier, isDataEqual, sortDataSetIds } from '$common/utils';
import { isEmpty } from 'lodash';
import { useHistory } from 'react-router-dom';
import { useIsOwner, useMeetsPolicyAccess } from '$core/provider/UserProvider';
import { useNoop, useStatefulRef } from '$common/hooks';

export function useUserCanEditDataProduct(dataProductIdentifier?: DataProductIdentifier): boolean | undefined {
  const [dataProductEntity] = dataProductIdentifier
    ? apiHooks.useDataProductDomainDataProduct(dataProductIdentifier, {
        enabled: dataProductIdentifier != null,
  }) : useNoop([]); // eslint-disable-line
  const [policy] = dataProductIdentifier
    ? apiHooks.useGovernancePolicyDomainDataProduct(dataProductIdentifier!, {
        enabled: dataProductIdentifier != null,
  }) : useNoop([]); // eslint-disable-line

  const isOwner = useIsOwner(dataProductEntity);
  const meetsAccess = useMeetsPolicyAccess('FULL', policy?.permissions);

  if (dataProductIdentifier == null || isOwner == null) return undefined;

  return meetsAccess || isOwner;
}

export function useDataProductState(dataProduct?: DataProduct): DataProductState {
  return useMemo(() => {
    return getDataProductState(dataProduct);
  }, [dataProduct]);
}

export function useDataProductStateRef(dataProduct?: DataProduct): RefObject<DataProductState | undefined> {
  const state = useDataProductState(dataProduct);

  return useStatefulRef(state);
}

interface UseAllDataProductsStatus {
  isLoading: boolean;
}

export function useAllDataProducts(options?: {
  enabled?: boolean;
}): [
  DataProductEntity[] | undefined,
  UseAllDataProductsStatus,
  ExtendedUseQueryResult<'listDataProductDomainDataProducts', UseQueryResult<DataProductEntity[], any>>[],
] {
  const enabled = options?.enabled ?? true;
  const [domains, domainsQueryInfo] = apiHooks.useAllDataProductDomains(undefined, { enabled });
  const batchRequests = useMemo(() => {
    return domains ? domains.map(({ domainId }) => ({ domainId })) : [];
  }, [domains]);

  const [dataProducts, batchQueryInfos] = apiHooks.useBatchDataProductDomainDataProducts(batchRequests, {
    enabled: enabled && !isEmpty(domains),
  });

  const status = useMemo<UseAllDataProductsStatus>(() => {
    if (domainsQueryInfo.isLoading) return { isLoading: true };
    if (batchQueryInfos.find((queryInfo) => queryInfo.isLoading)) return { isLoading: true };
    return { isLoading: false };
  }, [domainsQueryInfo, batchQueryInfos]);

  return useMemo(() => {
    if (!enabled) return [undefined, status, batchQueryInfos];
    return [dataProducts, status, batchQueryInfos];
  }, [enabled, dataProducts, status]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useLiveDataProductState(
  dataProductIdentifier: DataProductIdentifier,
): [
  DataProductState,
  ExtendedUseQueryResult<'getDataProductDomainDataProduct', UseQueryResult<GovernedDataProductEntity, any>>,
] {
  const [pollingInterval, setPollingInterval] = useState<number | false>(false);
  const [dataProductEntity, queryInfo] = apiHooks.useDataProductDomainDataProduct(dataProductIdentifier, {
    refetchInterval: pollingInterval,
  });
  const liveState = useDataProductState(dataProductEntity);
  const [state, setState] = useState<DataProductState>(liveState);

  // effectively memoize state on deltas
  useEffect(() => {
    if (isDataEqual(liveState, state) === false) {
      setState(liveState);
    }
  }, [liveState, state]);

  useEffect(() => {
    setPollingInterval(state.isProcessing ? POLLING.DATA_PRODUCT_STATUS : false);
  }, [state.isProcessing]);

  return [state, queryInfo];
}

export const useOpenInQueryWorkbench = () => {
  const history = useHistory();

  return useCallback(
    (sqlIdentifier: string) => {
      history.push(`/query/?query=SELECT * FROM ${sqlIdentifier} LIMIT 100`);
    },
    [history],
  );
};

export const useOpenDataProductInQueryWorkbench = (dataProduct?: DataProduct) => {
  const state = useDataProductState(dataProduct);
  const sqlIdentifier = dataProduct ? getDataProductSQLIdentitier(dataProduct) : null;
  const hasMultipleDatasets = Object.keys(dataProduct?.dataSets || {}).length > 1;
  const defaultDataset = sortDataSetIds(Object.keys(dataProduct?.dataSets || {}))[0];

  const open = useOpenInQueryWorkbench();

  const callback = useCallback(() => {
    if (sqlIdentifier == null) return;
    const _sqlIdentifier = hasMultipleDatasets ? `${sqlIdentifier}.${defaultDataset}` : sqlIdentifier;
    open(_sqlIdentifier);
  }, [sqlIdentifier, hasMultipleDatasets, defaultDataset, open]);

  if (state.isQueryable && sqlIdentifier) {
    return callback;
  }

  return undefined;
};
