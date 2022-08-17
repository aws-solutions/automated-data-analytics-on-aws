/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProduct } from '@ada/api';
import { Link } from 'aws-northstar';
import { LinkProps } from 'aws-northstar/components/Link';
import { getDataProductSQLIdentitier } from '$common/utils';
import { getDataProductUrl } from '../utils';
import React, { useMemo } from 'react';

export const DataProductLink: React.FC<{ dataProduct: DataProduct } & Omit<LinkProps, 'href' | 'children'>> = ({
  dataProduct,
  ...props
}) => {
  const { domainId, dataProductId, name } = dataProduct;

  return useMemo(() => {
    const id = getDataProductSQLIdentitier({ domainId, dataProductId });
    return (
      <Link key={id} {...props} href={getDataProductUrl(dataProduct)}>
        {name}
      </Link>
    );
  }, [domainId, dataProductId, name]);
};
