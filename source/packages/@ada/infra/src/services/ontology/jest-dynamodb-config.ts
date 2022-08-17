/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { EntityManagementTables } from '../api/components/entity/constructs/entity-management-tables';
import { InternalTokenKey } from '../../common/constructs/kms/internal-token-key';
import { OntologyServiceStack, OntologyServiceStackProps } from './stack';
import { TestApp, TestStack } from '@ada/cdk-core';
import { buildCdkEnvironmentForTests } from '@ada/microservice-test-common';

export const generateEnvironmentForTests = () => {
  const stack = new TestStack(new TestApp());
  return {
    ...buildCdkEnvironmentForTests<OntologyServiceStack, OntologyServiceStackProps>(
      OntologyServiceStack,
      {
        internalTokenKey: new InternalTokenKey(stack, 'internal-token', {
          keyAlias: 'internal-token-key',
          secretName: 'test-secret-tname',
        }),
        entityManagementTables: new EntityManagementTables(stack, 'EntityManagementTables'),
      },
      stack,
    ),
  };
};
