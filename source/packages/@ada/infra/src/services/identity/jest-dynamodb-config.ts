/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { FederatedRestApi } from '../../common/constructs/api';
import { IdentityServiceStack, IdentityServiceStackProps } from './stack';
import { TestApp } from '@ada/cdk-core';
import { TestStackWithMockedApiService, buildCdkEnvironmentForTests } from '@ada/microservice-test-common';

export const generateEnvironmentForTests = () => {
  type mockIdentityServiceStackProps = IdentityServiceStackProps & {
    federatedApi: FederatedRestApi;
  };
  const stack = new TestStackWithMockedApiService(new TestApp());
  const {
    userPool,
    federatedApi,
    internalTokenKey,
    notificationBus,
    entityManagementTables,
    counterTable,
    apiService,
  } = stack;

  return {
    ...buildCdkEnvironmentForTests<IdentityServiceStack, mockIdentityServiceStackProps>(
      IdentityServiceStack,
      {
        federatedApi,
        userPool,
        callbackUrls: ['https://test.dev/'],
        logoutUrls: ['https://test.dev/'],
        internalTokenKey,
        notificationBus,
        entityManagementTables,
        userIdScope: 'ada/test-scope',
        counterTable,
        cognitoDomain: 'test-domain.auth.ap-southeast-2.amazoncognito.com',
        accessRequestTable: apiService.accessRequestTable,
        apiAccessPolicyTable: apiService.apiAccessPolicyTable,
        groupTable: apiService.groupTable,
        machineTable: apiService.machineTable,
        tokenTable: apiService.tokenTable,
      },
      stack,
    ),
  };
};
