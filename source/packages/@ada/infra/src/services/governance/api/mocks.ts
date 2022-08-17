/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
export const MOCK_ATTRIBUTE_VALUE_POLICY = {
  attributeId: 'V1StGXR8_Z5jdHi6B-myT',
  group: 'Analysts',
  logicalExpression: 'Age BETWEEN 18 AND 30',
  description: 'Age must be between 18 and 30 inclusive',
  createdBy: 'user123',
  updatedBy: 'user456',
  createdTimestamp: '2021-07-27T22:02:50Z',
  updatedTimestamp: '2021-07-27T22:08:59Z',
};

export const MOCK_ATTRIBUTE_POLICY = {
  attributeId: 'V1StGXR8_Z5jdHi6B-myT',
  group: 'Analysts',
  lens: 'hashed',
  createdBy: 'user123',
  updatedBy: 'user456',
  createdTimestamp: '2021-07-27T22:02:50Z',
  updatedTimestamp: '2021-07-27T22:08:59Z',
};

export const MOCK_DEFAULT_LENS_POLICY = {
  dataProductId: 'my-customer-dp-id',
  defaultLensId: 'clear',
  defaultLensOverrides: {
    analysts: {
      lensId: 'autoRedactPII',
    },
  },
  createdBy: 'user123',
  updatedBy: 'user456',
  createdTimestamp: '2021-07-27T22:02:50Z',
  updatedTimestamp: '2021-07-27T22:08:59Z',
};

export const MOCK_SCRIPT_POLICY = {
  scriptId: 'json-transform-script',
  permissions: {
    admins: { access: 'FULL' },
  },
  createdBy: 'user123',
  updatedBy: 'user456',
  createdTimestamp: '2021-07-27T22:02:50Z',
  updatedTimestamp: '2021-07-27T22:08:59Z',
};

export const MOCK_DATAPRODUCT_POLICY = {
  dataProductId: 'my-customer-dp-id',
  domainId: 'my-customer-domain',
  permissions: {
    admins: { access: 'READ_SCHEMA' },
  },
  createdBy: 'user123',
  updatedBy: 'user456',
  createdTimestamp: '2021-07-27T22:02:50Z',
  updatedTimestamp: '2021-07-27T22:08:59Z',
};
