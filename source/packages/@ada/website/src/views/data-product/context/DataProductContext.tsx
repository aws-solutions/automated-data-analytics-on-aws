/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductIdentifier, GovernedDataProductEntity } from '@ada/api';
import { DataProductState } from '../common';
import { HookError, apiHooks } from '$api';
import { getDataProductSQLIdentitier, getDataProductSourceSQLIdentitier, isNotFoundError } from '$common/utils';
import { useIsOwner } from '$core/provider/UserProvider';
import { useLiveDataProductState, useUserCanEditDataProduct } from '../hooks';
import React, { createContext, useCallback, useContext, useMemo } from 'react';

interface IDataProductContext {
  identifier: DataProductIdentifier;
  dataProduct?: GovernedDataProductEntity;
  dataProductState: DataProductState;

  sqlIdentifier: string;
  sourceSqlIdentifier: string;

  isLoading: boolean;
  notFound: boolean;
  fetchError?: HookError | null;
  hasFailed: boolean;

  isDataProductOwner?: boolean;
  isUserAllowedToEdit?: boolean;
  canUserQuerySource: boolean;

  refetchDataProduct: () => Promise<void>;
  refetchDataProductState: () => Promise<void>;
}

const DataProductContext = createContext<IDataProductContext | undefined>(undefined);

export const useDataProductContext = () => {
  const context = useContext(DataProductContext);
  if (context == null) throw new Error('Must wrap with DataProductContext.Provider');
  return context;
};

export const DataProductContextProvider: React.FC<{ identifier: DataProductIdentifier }> = ({
  identifier,
  children,
}) => {
  const [dataProduct, { error, refetch }] = apiHooks.useDataProductDomainDataProduct(identifier);

  const [dataProductState, { refetch: refetchState }] = useLiveDataProductState(identifier);

  const isUserAllowedToEdit = useUserCanEditDataProduct(identifier);
  const isDataProductOwner = useIsOwner(dataProduct);
  const canUserQuerySource = isDataProductOwner === true;

  const refetchDataProduct = useCallback(async () => {
    await refetch({ force: true });
  }, [refetch]);

  const refetchDataProductState = useCallback(async () => {
    await refetchState({ force: true });
  }, [refetchState]);

  const context: IDataProductContext = useMemo(() => ({
    identifier,
    dataProduct,
    dataProductState,

    sqlIdentifier: getDataProductSQLIdentitier(identifier),
    sourceSqlIdentifier: getDataProductSourceSQLIdentitier(identifier),

    isLoading: dataProduct == null,
    hasFailed: error != null,
    notFound: isNotFoundError(error),
    fetchError: error,

    isUserAllowedToEdit,
    isDataProductOwner,
    canUserQuerySource,

    refetchDataProduct,
    refetchDataProductState,
  }), [
    identifier,
    dataProduct,
    dataProductState,
    error,
    
    isUserAllowedToEdit,
    isDataProductOwner,
    canUserQuerySource,

    refetchDataProduct,
    refetchDataProductState,
  ]);

  return <DataProductContext.Provider value={context}>{children}</DataProductContext.Provider>;
};
