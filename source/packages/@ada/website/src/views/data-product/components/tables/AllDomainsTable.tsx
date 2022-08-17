/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { BaseTable, BaseTableProps } from '$common/components/tables';
import { DataProductEntity } from '@ada/api-client';
import { Skeletons } from '$northstar-plus';
import { apiHooks } from '$api';
import { columnDefinitionsWithDomain } from './column-definitions';
import { isEmpty } from '@aws-amplify/core';
import { useAllDataProducts } from '../../hooks';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import React from 'react';

export type AllDomainsDataProductTableProps = Omit<BaseTableProps<DataProductEntity>, 'items' | 'columnDefinitions'>;

export const AllDomainsDataProductTable: React.FC<AllDomainsDataProductTableProps> = (props) => {
  const { LL } = useI18nContext();
  const [domains] = apiHooks.useDataProductDomains();
  const [items, { isLoading }] = useAllDataProducts();

  if (domains == null || isEmpty(domains)) {
    return <Skeletons.Table animation={false} />;
  }

  return (
    <BaseTable
      tableTitle={LL.ENTITY['data_products^'](LL.VIEW.misc.All())}
      columnDefinitions={columnDefinitionsWithDomain}
      loading={isLoading}
      items={items}
      {...props}
    />
  );
};
