/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { API_ACCESS_POLICY_BASE_PATH } from './base-paths';
import { ApiAccessPolicy } from '@ada/api';
import { ApiAccessPolicy as ApiAccessPolicySchema } from '../types';
import { BaseApiRoutes, BaseApiRoutesProps } from './base';
import { Construct } from 'constructs';
import { CounterTable } from '../../../../common/constructs/dynamodb/counter-table';
import { DefaultApiAccessPolicyIds } from '@ada/common';
import { EntityManagementTables } from '../../components/entity/constructs/entity-management-tables';
import { FederatedRestApi } from '@ada/infra-common/constructs/api';
import { InternalTokenKey } from '@ada/infra-common/constructs/kms/internal-token-key';
import { JsonSchemaType, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { StatusCodes } from 'http-status-codes/build/cjs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { TypescriptFunction } from '@ada/infra-common';
import { asEntity, asInput } from '../../../../common/constructs/api';
import InvokeMicroserviceLambda from '../../../../common/constructs/api/invoke-microservice-lambda';

/* eslint-disable sonarjs/no-duplicate-string */

export const ROUTE_PATH = API_ACCESS_POLICY_BASE_PATH;

export interface ApiAccessPolicyRoutesProps extends Omit<BaseApiRoutesProps, 'routePath'> {
  counterTable: CounterTable;
  readonly api: FederatedRestApi;
  readonly apiAccessPolicyTable: Table;
  readonly entityManagementTables: EntityManagementTables;
  readonly internalTokenKey: InternalTokenKey;
}

export class ApiAccessPolicyRoutes extends BaseApiRoutes {
  constructor(scope: Construct, id: string, props: ApiAccessPolicyRoutesProps) {
    super(scope, id, { ...props, routePath: ROUTE_PATH });

    const { apiAccessPolicyTable, counterTable, entityManagementTables, internalTokenKey } = props;

    const buildLambda = (handlerFile: string) =>
      new TypescriptFunction(this, `Lambda-${handlerFile}`, {
        package: 'api-service',
        handlerFile: require.resolve(`../handlers/api-access-policy/${handlerFile}`),
        environment: {
          API_ACCESS_POLICY_TABLE_NAME: apiAccessPolicyTable.tableName,
        },
        apiLayer: {
          endpoint: props.api.url,
        },
        counterTable,
        entityManagementTables,
        internalTokenKey,
      });

    const listPoliciesLambda = buildLambda('list-policies');
    apiAccessPolicyTable.grantReadData(listPoliciesLambda);
    const getPolicyLambda = buildLambda('get-policy');
    apiAccessPolicyTable.grantReadData(getPolicyLambda);
    const putPolicyLambda = buildLambda('put-policy');
    apiAccessPolicyTable.grantReadWriteData(putPolicyLambda);
    const deletePolicyLambda = buildLambda('delete-policy');
    apiAccessPolicyTable.grantReadWriteData(deletePolicyLambda);

    this.route.addRoutes({
      // GET /api-access-policy
      GET: {
        integration: new LambdaIntegration(listPoliciesLambda),
        paginated: true,
        response: {
          name: 'ListApiAccessPoliciesOutput',
          description: 'Available api access policies to associate with groups',
          schema: {
            type: JsonSchemaType.OBJECT,
            properties: {
              policies: {
                type: JsonSchemaType.ARRAY,
                items: asEntity(ApiAccessPolicySchema),
              },
            },
            required: ['policies'],
          },
          errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
        },
      },
      paths: {
        '/{apiAccessPolicyId}': {
          // GET /api-access-policy/{apiAccessPolicyId}
          GET: {
            integration: new LambdaIntegration(getPolicyLambda),
            response: {
              name: 'GetApiAccessPolicyOutput',
              description: 'The api access policy',
              schema: asEntity(ApiAccessPolicySchema),
              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN, StatusCodes.NOT_FOUND],
            },
          },
          // PUT /api-access-policy/{apiAccessPolicyId}
          PUT: {
            integration: new LambdaIntegration(putPolicyLambda),
            request: {
              name: 'PutApiAccessPolicyInput',
              description: 'Details of the api access policy to create/update',
              schema: asInput(ApiAccessPolicySchema),
            },
            response: {
              name: 'PutApiAccessPolicyOutput',
              description: 'The created/updated api access policy',
              schema: asEntity(ApiAccessPolicySchema),
              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
            },
          },
          // DELETE /api-access-policy/{apiAccessPolicyId}
          DELETE: {
            integration: new LambdaIntegration(deletePolicyLambda),
            response: {
              name: 'DeleteApiAccessPolicyOutput',
              description: 'The deleted api access policy',
              schema: asEntity(ApiAccessPolicySchema),
              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN, StatusCodes.NOT_FOUND],
            },
          },
        },
      },
    });

    // Helper to make defining permissions less verbose
    type ApiPermission = ['GET' | 'POST' | 'PUT' | 'DELETE' | '*', string[]];
    const toResources = (permissions: ApiPermission[]) =>
      permissions.flatMap(([method, paths]) => paths.map((path) => props.api.arnForExecuteApi(method, path, '*')));

    const defaultPolicies: ApiAccessPolicy[] = [
      {
        apiAccessPolicyId: DefaultApiAccessPolicyIds.DEFAULT,
        name: 'Default Access',
        description:
          'Access to run queries, view data products and domains, recieve notifications, request group membership, etc',
        resources: toResources([
          [
            'GET',
            [
              // Read all api access policies
              '/api-access-policy',
              '/api-access-policy/*',
              // Read data products and domains
              '/data-product/*',
              // Read governance rules
              '/governance/*',
              // Read access to groups and user
              '/identity/attributes',
              '/identity/group',
              '/identity/group/*',
              // Read access to user requests - further scope by handler to owner
              '/identity/request',
              '/identity/request/*',
              // Access to get permissions for a specific user - scope to owner/admin by handler
              '/permission/user/*',
              // Read access to notifications - scope to owner/admin by handler
              '/notification',
              '/notification/*',
              // Read access to ontology attributes
              '/ontology',
              '/ontology/*',
              // Read access to queries (eg saved queries or query history)
              '/query/*',
            ],
          ],
          // Execute queries
          ['POST', ['/query']],
          ['POST', ['/query-parse-render/*']],
          // Save and delete saved queries
          ['PUT', ['/query/*']],
          ['DELETE', ['/query/saved-query/*']],
          [
            'PUT',
            [
              // Dismiss notifications - further scoped to owner by handler
              '/notification/*',
              // Request access to groups
              '/identity/request/*',
            ],
          ],
          // Edit data product schema (access is managed at the data product level so api access is granted as a basic
          // "read only" permission)
          ['PUT', ['/data-product/domain/*/data-product/*']],
          // Edit data product permissions (access is managed at the data product level (via its permissions) so api
          // access is granted as a basic "read only" permission)
          ['PUT', ['/governance/policy/domain/*']],
        ]),
      },
      {
        apiAccessPolicyId: DefaultApiAccessPolicyIds.PROGRAMMATIC_ACCESS,
        name: 'Programmatic Access',
        description: 'Allows creation and management of api tokens for programmatic access',
        resources: toResources([
          // Full access to machines and tokens
          // Further scoped to owner/admin by handler.
          ['*', ['/identity/machine', '/identity/machine/*']],
        ]),
      },
      {
        apiAccessPolicyId: DefaultApiAccessPolicyIds.MANAGE_DATA_PRODUCTS,
        name: 'Manage Data Products',
        description: 'Allows creation, editing, and deletion of data products along with specific permission levels',
        resources: toResources([
          // Full access to data products
          ['*', ['/data-product/domain', '/data-product/domain/*']],
          // Full access to preview data products
          ['*', ['/data-product-preview', '/data-product-preview/*']],
          // Full access to data product level governance (ie data product policies and default lens policies)
          // Further scoped by handler to owner/admin
          [
            '*',
            [
              '/governance/policy/default-lens',
              '/governance/policy/default-lens/*',
              '/governance/policy/domain',
              '/governance/policy/domain/*',
            ],
          ],
        ]),
      },
      {
        apiAccessPolicyId: DefaultApiAccessPolicyIds.MANAGE_CUSTOM_SCRIPTS,
        name: 'Manage Custom Scripts',
        description: 'Access to create and manage custom transform scripts that will be executed',
        resources: toResources([['*', ['/data-product/scripts', '/data-product/scripts/*']]]),
      },
      {
        apiAccessPolicyId: DefaultApiAccessPolicyIds.MANAGE_GOVERNANCE,
        name: 'Manage Governance',
        description: 'Allows full access to manage governance at both solution and data product levels',
        resources: toResources([
          // Write access to ontology
          ['*', ['/ontology', '/ontology/*', '/governance', '/governance/*']],
        ]),
      },
      {
        apiAccessPolicyId: DefaultApiAccessPolicyIds.MANAGE_GROUPS,
        name: 'Manage Groups',
        description: 'Allows creation of groups, assigning users to groups, actioning access requests',
        resources: toResources([
          // Write access to groups
          ['*', ['/identity/group', '/identity/group/*']],
          // Write access to approve/deny requests
          ['*', ['/identity/request', '/identity/request/*']],
          // Access to list all users for assigning them to groups
          ['GET', ['/identity/user', '/identity/user/*']],
        ]),
      },
      {
        apiAccessPolicyId: DefaultApiAccessPolicyIds.MANAGE_IDENTITY_PROVIDERS,
        name: 'Manage Identity Providers',
        description: 'Access to view, edit, and delete the identity provides for federated access',
        resources: toResources([['*', ['/identity/provider', '/identity/provider/*']]]),
      },
      {
        apiAccessPolicyId: DefaultApiAccessPolicyIds.ADMINISTRATOR_ACCESS,
        name: 'Administrator Access',
        description: 'Full access to all apis, including management of groups, identity providers and api access',
        resources: toResources([['*', ['/*']]]),
      },
    ];

    InvokeMicroserviceLambda.makeSequential(defaultPolicies.map((policy) => {
      return new InvokeMicroserviceLambda(this, `PutDefaultApiPolicy-${policy.apiAccessPolicyId}`, {
        lambda: putPolicyLambda,
        pathParameters: { apiAccessPolicyId: policy.apiAccessPolicyId },
        body: policy,
      });
    }));
  }
}
