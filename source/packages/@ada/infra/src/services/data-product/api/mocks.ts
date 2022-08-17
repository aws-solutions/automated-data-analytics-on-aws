/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import {
  DataProductDataStatus,
  DataProductInfrastructureStatus,
  DataProductUpdateTriggerType,
  SourceType,
} from '@ada/common';

export const MOCK_DOMAIN = {
  domainId: 'my-domain-id',
  name: 'Marketing',
  description: 'The marketing domain',
  createdBy: 'user123',
  createdTimestamp: '2021-08-02T07:16:17Z',
  updatedBy: 'user123',
  updatedTimestamp: '2021-08-02T07:16:17Z',
};

export const MOCK_DATA_PRODUCT = {
  dataProductId: 'my-customer-dp-id',
  domainId: 'my-domain-id',
  name: 'Customers',
  description: 'Full record of all customers',
  owningGroups: ['group1', 'group2'],
  sourceType: SourceType.S3,
  sourceDetails: {
    bucket: 'examplebucket',
    key: 'mydata',
  },
  tags: [{ key: 'Key', value: 'Value' }],
  dataSets: {
    customerDataSet: {
      identifiers: {
        catalog: 'AwsDataCatalog',
        database: 'processed_db',
        table: 'customers_data_product',
      },
      columnMetadata: {
        firstName: {
          dataType: 'string',
          ontologyAttributeId: 'name-attribute-id',
          description: 'The customer first name',
        },
        lastName: {
          dataType: 'string',
          ontologyAttributeId: 'name-attribute-id',
          description: 'The customer last name',
        },
        email: {
          dataType: 'string',
          description: 'The customer email',
        },
      },
    },
  },
  cloudFormationStackId: 'abc123',
  infrastructureStatus: DataProductInfrastructureStatus.READY,
  infrastructureStatusDetails: '',
  dataStatus: DataProductDataStatus.READY,
  dataStatusDetails: '',
  latestDataUpdateTimestamp: '2021-08-02T07:16:17Z',
  updateTrigger: {
    triggerType: DataProductUpdateTriggerType.AUTOMATIC,
  },
  transforms: [
    {
      scriptId: 'my-transform-script',
    },
    {
      scriptId: 'ada-json-relationalize',
    },
  ],
  createdBy: 'user123',
  createdTimestamp: '2021-08-02T07:16:17Z',
  updatedBy: 'user123',
  updatedTimestamp: '2021-08-02T07:16:17Z',
};

export const MOCK_SCRIPT = {
  scriptId: 'script-123',
  name: 'My Transform',
  description: 'Does some transformation',
  createdBy: 'user123',
  createdTimestamp: '2021-08-02T07:16:17Z',
  updatedBy: 'user123',
  updatedTimestamp: '2021-08-02T07:16:17Z',
};
