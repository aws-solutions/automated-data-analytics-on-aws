/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AllQueryResultTable, ConstrainedAllQueryResultTableProps } from '$common/components/tables';
import { columnDefinitions } from './column-definitions';
import { identifierToName } from '$common/utils';
import { useI18nContext } from '$strings';
import React from 'react';
import apiHooks from '$api/hooks';

export interface DomainDataProductTableProps
  extends ConstrainedAllQueryResultTableProps<'listDataProductDomainDataProducts'> {
  readonly domainId: string;
}

export const DomainDataProductTable: React.FC<DomainDataProductTableProps> = ({ domainId, ...props }) => {
  const { LL } = useI18nContext();
  const allQueryResult = apiHooks.useAllDataProductDomainDataProducts({ domainId });

  return (
    <AllQueryResultTable<'listDataProductDomainDataProducts'>
      tableTitle={LL.ENTITY['data_products^'](identifierToName(domainId))}
      columnDefinitions={columnDefinitions}
      allQueryResult={allQueryResult}
      {...props}
    />
  );
};
