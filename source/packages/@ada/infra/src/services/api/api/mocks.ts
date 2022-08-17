/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

export const MOCK_GROUP = {
  groupId: 'admin-group',
  description: 'The administrator group',
  claims: ['company_ada_admin', 'company_it_services', 'some-machine-for-power-bi'],
  members: ['username_one', 'username_two', 'username_three'],
  apiAccessPolicyIds: ['administer-permissions', 'read', 'administer-identity'],
  createdBy: 'user123',
  createdTimestamp: '2021-08-02T07:16:17Z',
  updatedBy: 'user123',
  updatedTimestamp: '2021-08-02T07:16:17Z',
};

export const MOCK_MACHINE = {
  machineId: 'some-machine-for-power-bi',
  description: 'Machine for using ada in PowerBI',
  createdBy: 'user123',
  createdTimestamp: '2021-08-02T07:16:17Z',
  updatedBy: 'user123',
  updatedTimestamp: '2021-08-02T07:16:17Z',
};

export const MOCK_PROVIDER = {
  name: 'Corporate Provider',
  type: 'OIDC',
  description: 'My corporate identity provider',
  details: {
    clientId: 'my-oidc-client',
    clientSecret: 'my-oidc-secret',
  },
  createdBy: 'user123',
  createdTimestamp: '2021-08-02T07:16:17Z',
  updatedBy: 'user123',
  updatedTimestamp: '2021-08-02T07:16:17Z',
};
