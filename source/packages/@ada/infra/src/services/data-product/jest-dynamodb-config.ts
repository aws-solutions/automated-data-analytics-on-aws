/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb'; // must be imported before any aliases
import { Bucket } from '../../common/constructs/s3/bucket';
import { CountedTable } from '../../common/constructs/dynamodb/counted-table';
import { DataProductServiceStack, DataProductServiceStackProps } from './stack';
import { JsonSchema, JsonSchemaType } from 'aws-cdk-lib/aws-apigateway';
import { MicroserviceApi } from '@ada/microservice-common';
import { NestedStack } from 'aws-cdk-lib';
import { StatusCodes } from 'http-status-codes';
import { TestApp } from '@ada/cdk-core';
import { TestStackWithMockedApiService, buildCdkEnvironmentForTests } from '@ada/microservice-test-common';
import { successMockIntegration } from '../../utils/api';

export const generateEnvironmentForTests = () => {
  const MOCK_ID = {
    mockId: 'mock-123',
  };

  const MockId: JsonSchema = {
    type: JsonSchemaType.OBJECT,
    properties: {
      MockId: {
        type: JsonSchemaType.STRING,
      },
    },
    required: ['mockId'],
  };
  const stack = new TestStackWithMockedApiService(new TestApp());
  const { federatedApi, 
    accessLogsBucket, 
    counterTable, 
    notificationBus, 
    entityManagementTables, 
    internalTokenKey, 
    operationalMetricsConfig } = stack;

  const resource = federatedApi.addRootResource('resource');
  resource.addRoutes({
    PUT: {
      integration: successMockIntegration(MOCK_ID),
      request: {
        name: 'PutMockInput',
        description: 'A mock to send',
        schema: MockId,
      },
      response: {
        name: 'PutMockOutput',
        description: 'A mock id to track',
        schema: MockId,
        errorStatusCodes: [StatusCodes.BAD_REQUEST],
      },
    },
  });

  const microserviceApiMock = new MicroserviceApi(new NestedStack(stack, 'MOCK-NestedStack'), 'MOCK-MicroserviceApi', {
    federatedApi,
    serviceName: 'MockService',
    serviceNamespace: 'mock',
  });

  return {
    ...buildCdkEnvironmentForTests<DataProductServiceStack, DataProductServiceStackProps>(
      DataProductServiceStack,
      {
        athenaOutputBucket: new Bucket(stack, 'Bucket', {}),
        accessLogsBucket,
        federatedApi,
        notificationBus,
        executeAthenaQueryLambdaRoleArn: 'arn:aws:iam::123456789012:role/mock-role-name',
        governanceApi: microserviceApiMock,
        queryParseRenderApi: microserviceApiMock,
        ontologyApi: microserviceApiMock,
        internalTokenKey,
        entityManagementTables,
        cachedQueryTable: new CountedTable(stack, 'CachedQueryTable', {
          partitionKey: {
            name: 'cacheId',
            type: AttributeType.STRING,
          },
          counterTable,
        }),
        operationalMetricsConfig,
      },
      stack,
    ),
  };
};
