/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductEntity, DomainEntity } from '@ada/api';

const P = '-';

export const Domain: DomainEntity = {
  domainId: P,
  name: P,
  description: P,
  createdBy: P,
  updatedBy: P,
};

export const DataProduct: DataProductEntity = {
  domainId: P,
  dataProductId: P,
  name: P,
  description: P,
  dataSets: {},
  childDataProducts: [],
  parentDataProducts: [],
  sourceType: P as any,
  tags: [],
  transforms: [],
  updateTrigger: P as any,
  createdBy: P,
  updatedBy: P,
};
