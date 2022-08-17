/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { Arn, Stack } from 'aws-cdk-lib';
import { BaseApiRoutes, BaseApiRoutesProps } from './base';
import { Construct } from 'constructs';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { EntityManagementTables } from '../../components/entity/constructs/entity-management-tables';
import { FederatedRestApi } from '../../../../common/constructs/api/federated-api';
import { InternalTokenKey } from '@ada/infra-common/constructs/kms/internal-token-key';
import { JsonSchemaType } from '@ada/common';
import { LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { PERMISSION_BASE_PATH } from './base-paths';
import { StatusCodes } from 'http-status-codes';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { TypescriptFunction } from '@ada/infra-common';
import { UserPermission } from '../types';
import { UserPool } from 'aws-cdk-lib/aws-cognito';

export const ROUTE_PATH = PERMISSION_BASE_PATH;

export interface PermissionsApiRoutesProps extends Omit<BaseApiRoutesProps, 'routePath'> {
  readonly api: FederatedRestApi;
  readonly internalTokenKey: InternalTokenKey;
  readonly entityManagementTables: EntityManagementTables;
  readonly groupTable: Table;
  readonly apiAccessPolicyTable: Table;
  readonly userPool: UserPool;
}

export class PermissionsApiRoutes extends BaseApiRoutes {
  readonly listUserPermission: TypescriptFunction;

  constructor(scope: Construct, id: string, props: PermissionsApiRoutesProps) {
    super(scope, id, { ...props, routePath: ROUTE_PATH });
    const { entityManagementTables, internalTokenKey, api, groupTable, apiAccessPolicyTable } = props;

    // Utility method for lambda handlers
    const buildLambda = (handlerFile: string) =>
      new TypescriptFunction(this, `Lambda-${handlerFile}`, {
        package: 'permissions-service',
        handlerFile: require.resolve(`../handlers/${handlerFile}`),
        environment: {
          REST_API_ID: props.api.restApiId,
          USER_POOL_ID: props.userPool.userPoolId,
          GROUP_TABLE_NAME: groupTable.tableName,
          API_ACCESS_POLICY_TABLE_NAME: apiAccessPolicyTable.tableName,
        },
        apiLayer: {
          endpoint: api.url,
        },
        entityManagementTables,
        internalTokenKey,
      });

    this.listUserPermission = buildLambda('list-user-permission');
    this.listUserPermission.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['cognito-idp:AdminGetUser'],
        resources: [props.userPool.userPoolArn],
      }),
    );
    this.listUserPermission.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['apigateway:GET'],
        resources: [
          Arn.format(
            {
              resource: '/restapis',
              service: 'apigateway',
              resourceName: `${props.api.restApiId}/resources`,
              account: '',
            },
            Stack.of(this),
          ),
        ],
      }),
    );
    groupTable.grantReadData(this.listUserPermission);
    apiAccessPolicyTable.grantReadData(this.listUserPermission);

    this.route.addRoutes({
      paths: {
        '/user': {
          paths: {
            '/{userId}': {
              // GET /permission/user/{userId}
              GET: {
                integration: new LambdaIntegration(this.listUserPermission),
                response: {
                  name: 'GetUserPermissionOutput',
                  description: 'The list of APIs that the user has access to',
                  schema: {
                    type: JsonSchemaType.OBJECT,
                    properties: {
                      permissions: UserPermission,
                    },
                    required: ['permissions'],
                  },
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN, StatusCodes.NOT_FOUND],
                },
              },
            },
          },
        },
      },
    });
  }
}
