/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb'; // must be imported before any aliases
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CountedTable } from '../../common/constructs/dynamodb/counted-table';
import { DefinitionBody, Pass, StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { NestedStack } from 'aws-cdk-lib';
import { RetainedAspect, TestApp } from '@ada/cdk-core';
import { TestStackWithMockedApiService, buildCdkEnvironmentForTests } from '@ada/microservice-test-common';
import AdministrationServiceStack, { AdministrationServiceStackProps } from './stack';
import DataProductCreationStateMachine from '../data-product/components/creation-state-machine';

export const generateEnvironmentForTests = () => {
  const stack = new TestStackWithMockedApiService(new TestApp());
  new RetainedAspect(stack); //NOSONAR (S1848) - cdk construct is used
  const {
    federatedApi,
    counterTable,
    notificationBus,
    entityManagementTables,
    internalTokenKey,
    operationalMetricsConfig,
  } = stack;

  return {
    ...buildCdkEnvironmentForTests<AdministrationServiceStack, AdministrationServiceStackProps>(
      AdministrationServiceStack,
      {
        federatedApi,
        coreStack: new NestedStack(stack, 'core'),
        counterTable,
        dataBuckets: [new Bucket(stack, 'DataBucket')],
        dataProductCreationStateMachine: new DataProductCreationStateMachine(stack, 'CreationStateMachine', {
          counterTable,
          entityManagementTables,
          federatedApi,
          glueCrawlerStateMachine: new StateMachine(stack, 'CrawlerStateMachine', {
            definitionBody: DefinitionBody.fromChainable(new Pass(stack, 'noop')),
          }),
          internalTokenKey,
          notificationBus,
          operationalMetricsConfig,
        }),
        dataProductTable: new CountedTable(stack, 'DataProductTable', {
          partitionKey: {
            name: 'domainId',
            type: AttributeType.STRING,
          },
          sortKey: {
            name: 'dataProductId',
            type: AttributeType.STRING,
          },
          counterTable,
        }),
        notificationBus,
        internalTokenKey,
        entityManagementTables,
      },
      stack,
    ),
  };
};
