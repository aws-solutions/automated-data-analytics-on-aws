/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Bucket } from '../../common/constructs/s3/bucket';
import { BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { EntityManagementTables } from './components/entity/constructs/entity-management-tables';
import { FederatedRestApi } from '@ada/infra-common/constructs/api';
import { InternalTokenKey } from '../../common/constructs/kms/internal-token-key';
import { TestApp, TestStack } from '@ada/cdk-core';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { buildCdkEnvironmentForTests } from '@ada/microservice-test-common';
import ApiServiceStack, { ApiServiceStackProps } from './stack';

export const generateEnvironmentForTests = () => {
  type mockApiServiceStackProps = ApiServiceStackProps & {
    federatedApi: FederatedRestApi;
  };
  const stack = new TestStack(new TestApp());

  const userPool = new UserPool(stack, 'UserPool', {});

  return {
    ...buildCdkEnvironmentForTests<ApiServiceStack, mockApiServiceStackProps>(
      ApiServiceStack,
      {
        federatedApi: {} as any,
        adaUserPoolProps: {
          advancedSecurityMode: 'ENFORCED',
          selfSignUpEnabled: false,
        },
        userPool,
        autoAssociateAdmin: '',
        adminEmailAddress: '',
        internalTokenKey: new InternalTokenKey(stack, 'internal-token', {
          keyAlias: 'internal-token-key',
          secretName: 'test-secret-tname',
        }),
        userIdScope: 'ada/test-scope',
        cognitoDomain: 'test-domain.auth.ap-southeast-2.amazoncognito.com',
        entityManagementTables: new EntityManagementTables(stack, 'EntityManagementTables'),
        accessLogsBucket: new Bucket(stack, 'AccessLog', {
          // SSE-S3 is the only supported default bucket encryption for Server Access Logging target buckets
          encryption: BucketEncryption.S3_MANAGED,
        }),
      },
      stack,
    ),
  };
};
