/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket } from '../../common/constructs/s3/bucket';
import { CountedTable } from '../../common/constructs/dynamodb/counted-table';
import { JsonSchema, JsonSchemaType } from 'aws-cdk-lib/aws-apigateway';
import { Key } from 'aws-cdk-lib/aws-kms';
import { MicroserviceApi } from '../../common/services';
import { NestedStack } from 'aws-cdk-lib';
import { StatusCodes } from 'http-status-codes';
import { TestApp } from '@ada/cdk-core';
import { TestStackWithMockedApiService, buildCdkEnvironmentForTests } from '../../common/services/testing';
import { successMockIntegration } from '@ada/infra/src/utils/api';
import QueryServiceStack, { QueryServiceStackProps } from './stack';

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
  const { accessLogsBucket, 
    federatedApi, 
    internalTokenKey, 
    notificationBus, 
    entityManagementTables,
    operationalMetricsConfig,
  } = stack;

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

  const cachedQueryTable = new CountedTable(stack, 'CachedQueryTable', {
    partitionKey: {
      name: 'cacheId',
      type: AttributeType.STRING,
    },
    counterTable: stack.counterTable,
  });
  const glueKmsKey = new Key(stack, 'GlueKey', {});

  return {
    ...buildCdkEnvironmentForTests<QueryServiceStack, QueryServiceStackProps>(
      QueryServiceStack,
      {
        federatedApi,
        executeAthenaQueryLambdaRoleArn: 'arn:aws:iam::123456789012:role/mock-role-name',
        dataProductApi: microserviceApiMock,
        ontologyApi: microserviceApiMock,
        queryParseRenderApi: microserviceApiMock,
        governanceApi: microserviceApiMock,
        cachedQueryTable,
        internalTokenKey,
        cognitoDomain: 'test-domain.auth.ap-southeast-2.amazoncognito.com',
        entityManagementTables,
        glueKmsKey,
        athenaOutputBucket: new Bucket(stack, 'AthenaOutputBucket', {}),
        accessLogsBucket,
        notificationBus,
        operationalMetricsConfig,
      },
      stack,
    ),
  };
};
