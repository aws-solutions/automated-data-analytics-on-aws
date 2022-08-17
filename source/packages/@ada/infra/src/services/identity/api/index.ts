/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  AccessRequest,
  GroupMembers,
  Group as GroupSchema,
  IdentityAttributes,
  IdentityProvider,
  Machine,
  Token,
  UserSchema,
} from './types';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { CountedTable } from '../../../common/constructs/dynamodb/counted-table';
import { CounterTable } from '../../../common/constructs/dynamodb/counter-table';
import { DESCRIPTION_VALIDATION, DefaultApiAccessPolicyIds, DefaultClaims, DefaultGroupIds } from '@ada/common';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { EntityManagementTables } from '../../api/components/entity/constructs/entity-management-tables';
import { Group } from '@ada/api-client';
import { IdentityProviderEvents, MicroserviceApi, MicroserviceApiProps } from '@ada/microservice-common';
import { InternalTokenKey } from '../../../common/constructs/kms/internal-token-key';
import { JsonSchemaType, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { NotificationBus } from '../../api/components/notification/constructs/bus';
import { Rule } from 'aws-cdk-lib/aws-events';
import { StatusCodes } from 'http-status-codes/build/cjs';
import { TypescriptFunction } from '@ada/infra-common';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { asEntity, asInput, asNonEntityInput, cloneSchema } from '../../../common/constructs/api';
import InvokeMicroserviceLambda from '../../../common/constructs/api/invoke-microservice-lambda';

enum COGNITO_IDP_ACTION {
  DescribeIdentityProvider = 'cognito-idp:DescribeIdentityProvider',
  CreateIdentityProvider = 'cognito-idp:CreateIdentityProvider',
  UpdateIdentityProvider= 'cognito-idp:UpdateIdentityProvider',
  DescribeUserPoolClient= 'cognito-idp:DescribeUserPoolClient',
  UpdateUserPoolClient = 'cognito-idp:UpdateUserPoolClient',
  DeleteIdentityProvider = 'cognito-idp:DeleteIdentityProvider',
  DescribeUserPool = 'cognito-idp:DescribeUserPool',
  DeleteUserPoolClient = 'cognito-idp:DeleteUserPoolClient',
  CreateUserPoolClient = 'cognito-idp:CreateUserPoolClient',
  ListUsers = 'cognito-idp:ListUsers',
}
export interface IdentityApiProps extends MicroserviceApiProps {
  readonly notificationBus: NotificationBus;
  readonly userPool: UserPool;
  readonly userPoolClient: UserPoolClient;
  readonly groupTable: Table;
  readonly apiAccessPolicyTable: Table;
  readonly machineTable: Table;
  readonly tokenTable: Table;
  readonly counterTable: CounterTable;
  readonly accessRequestTable: Table;
  readonly entityManagementTables: EntityManagementTables;
  readonly internalTokenKey: InternalTokenKey;
  readonly userIdScope: string;
  readonly cognitoDomain: string;
}

export class IdentityApi extends MicroserviceApi {
  readonly putGroupLambda: TypescriptFunction;
  readonly putGroupMembersLambda: TypescriptFunction;
  readonly listGroupLambda: TypescriptFunction;
  readonly getGroupLambda: TypescriptFunction;
  readonly deleteGroupLambda: TypescriptFunction;
  readonly putIdentityProvider: TypescriptFunction;
  readonly getIdentityProvider: TypescriptFunction;
  readonly listIdentityProvider: TypescriptFunction;
  readonly deleteIdentityProvider: TypescriptFunction;
  readonly deleteIdentityProviderSync: TypescriptFunction;
  readonly getUserPoolAttributes: TypescriptFunction;
  readonly putMachine: TypescriptFunction;
  readonly getMachine: TypescriptFunction;
  readonly listMachine: TypescriptFunction;
  readonly deleteMachine: TypescriptFunction;
  readonly putToken: TypescriptFunction;
  readonly getToken: TypescriptFunction;
  readonly listToken: TypescriptFunction;
  readonly deleteToken: TypescriptFunction;
  readonly putAccessRequest: TypescriptFunction;
  readonly getAccessRequest: TypescriptFunction;
  readonly listAccessRequest: TypescriptFunction;
  readonly deleteAccessRequest: TypescriptFunction;
  readonly actionAccessRequest: TypescriptFunction;
  readonly listUsers: TypescriptFunction;

  constructor(scope: Construct, id: string, props: IdentityApiProps) {
    super(scope, id, props);

    const {
      groupTable,
      machineTable,
      accessRequestTable,
      tokenTable,
      notificationBus,
      counterTable,
      entityManagementTables,
      internalTokenKey,
      apiAccessPolicyTable,
      userIdScope,
      cognitoDomain,
      userPool,
    } = props;

    // Stores details about identity providers
    const identityProviderTable = new CountedTable(this, 'IdentityProviderTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'identityProviderId',
        type: AttributeType.STRING,
      },
      counterTable,
    });

    // Utility method for lambda handlers
    const buildLambda = (handlerFile: string) =>
      new TypescriptFunction(this, `Lambda-${handlerFile}`, {
        package: 'identity-service',
        handlerFile: require.resolve(`./handlers/${handlerFile}`),
        environment: {
          GROUP_TABLE_NAME: groupTable.tableName,
          IDENTITY_PROVIDER_TABLE_NAME: identityProviderTable.tableName,
          USER_POOL_ID: userPool.userPoolId,
          USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId,
          MACHINE_TABLE_NAME: machineTable.tableName,
          TOKEN_TABLE_NAME: tokenTable.tableName,
          ACCESS_REQUEST_TABLE_NAME: accessRequestTable.tableName,
          API_ACCESS_POLICY_TABLE_NAME: apiAccessPolicyTable.tableName,
          DEFAULT_SCOPE: userIdScope,
          COGNITO_DOMAIN: cognitoDomain,
        },
        apiLayer: {
          endpoint: props.federatedApi.url,
        },
        internalTokenKey,
        notificationBus,
        counterTable,
        entityManagementTables,
      });

    this.putGroupLambda = buildLambda('put-group');
    groupTable.grantReadWriteData(this.putGroupLambda);

    this.deleteGroupLambda = buildLambda('delete-group');
    groupTable.grantReadWriteData(this.deleteGroupLambda);

    this.putGroupMembersLambda = buildLambda('put-group-members');
    groupTable.grantReadWriteData(this.putGroupMembersLambda);

    this.getGroupLambda = buildLambda('get-group');
    groupTable.grantReadData(this.getGroupLambda);

    this.listGroupLambda = buildLambda('list-group');
    groupTable.grantReadData(this.listGroupLambda);

    this.putIdentityProvider = buildLambda('put-identity-provider');
    identityProviderTable.grantReadWriteData(this.putIdentityProvider);
    this.putIdentityProvider.addToRolePolicy(
      new PolicyStatement({
        actions: [
          COGNITO_IDP_ACTION.DescribeIdentityProvider,
          COGNITO_IDP_ACTION.CreateIdentityProvider,
          COGNITO_IDP_ACTION.UpdateIdentityProvider,
          COGNITO_IDP_ACTION.DescribeUserPoolClient,
          COGNITO_IDP_ACTION.UpdateUserPoolClient,
        ],
        resources: [props.userPool.userPoolArn],
        effect: Effect.ALLOW,
      }),
    );

    this.deleteIdentityProvider = buildLambda('delete-identity-provider');
    identityProviderTable.grantReadWriteData(this.deleteIdentityProvider);
    this.deleteIdentityProvider.addToRolePolicy(
      new PolicyStatement({
        actions: [
          COGNITO_IDP_ACTION.DescribeIdentityProvider,
          COGNITO_IDP_ACTION.DeleteIdentityProvider,
          COGNITO_IDP_ACTION.UpdateIdentityProvider,
          COGNITO_IDP_ACTION.DescribeUserPoolClient,
          COGNITO_IDP_ACTION.UpdateUserPoolClient,
        ],
        resources: [props.userPool.userPoolArn],
        effect: Effect.ALLOW,
      }),
    );

    this.deleteIdentityProviderSync = buildLambda('event-bridge/delete-identity-provider-sync');
    identityProviderTable.grantReadWriteData(this.deleteIdentityProviderSync);
    this.deleteIdentityProviderSync.addToRolePolicy(
      new PolicyStatement({
        actions: [COGNITO_IDP_ACTION.DescribeIdentityProvider],
        resources: [props.userPool.userPoolArn],
        effect: Effect.ALLOW,
      }),
    );

    const deleteIdpRule = new Rule(this, 'DeleteIdentityProviderRule', {
      description: 'Rule matching events from Cognito that an identity provider has been deleted.',
      eventPattern: {
        source: ['aws.cognito-idp'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventName: [IdentityProviderEvents.DELETE_IDP],
          requestParameters: {
            userPoolId: [userPool.userPoolId],
          },
        },
      },
    });

    deleteIdpRule.addTarget(new LambdaFunction(this.deleteIdentityProviderSync, { retryAttempts: 1 }));

    this.getIdentityProvider = buildLambda('get-identity-provider');
    identityProviderTable.grantReadData(this.getIdentityProvider);

    this.listIdentityProvider = buildLambda('list-identity-provider');
    identityProviderTable.grantReadData(this.listIdentityProvider);

    this.getUserPoolAttributes = buildLambda('get-userpool-attributes');
    this.getUserPoolAttributes.addToRolePolicy(
      new PolicyStatement({
        actions: [COGNITO_IDP_ACTION.DescribeUserPool],
        resources: [props.userPool.userPoolArn],
        effect: Effect.ALLOW,
      }),
    );

    this.putMachine = buildLambda('put-machine');
    machineTable.grantReadWriteData(this.putMachine);

    this.getMachine = buildLambda('get-machine');
    machineTable.grantReadData(this.getMachine);

    this.listMachine = buildLambda('list-machine');
    machineTable.grantReadData(this.listMachine);

    this.deleteMachine = buildLambda('delete-machine');
    machineTable.grantReadWriteData(this.deleteMachine);
    tokenTable.grantReadWriteData(this.deleteMachine);

    this.putToken = buildLambda('put-token');
    this.putToken.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [COGNITO_IDP_ACTION.CreateUserPoolClient],
        resources: [userPool.userPoolArn],
      }),
    );
    tokenTable.grantReadWriteData(this.putToken);
    machineTable.grantReadData(this.putToken);

    this.getToken = buildLambda('get-token');
    tokenTable.grantReadData(this.getToken);

    this.listToken = buildLambda('list-token');
    tokenTable.grantReadData(this.listToken);
    machineTable.grantReadData(this.listToken);

    this.deleteToken = buildLambda('delete-token');
    this.deleteToken.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [COGNITO_IDP_ACTION.DeleteUserPoolClient],
        resources: [userPool.userPoolArn],
      }),
    );
    tokenTable.grantReadWriteData(this.deleteToken);

    this.putAccessRequest = buildLambda('access-request/put');
    accessRequestTable.grantReadWriteData(this.putAccessRequest);
    groupTable.grantReadData(this.putAccessRequest);

    this.getAccessRequest = buildLambda('access-request/get');
    accessRequestTable.grantReadData(this.getAccessRequest);

    this.listAccessRequest = buildLambda('access-request/list');
    accessRequestTable.grantReadData(this.listAccessRequest);

    this.deleteAccessRequest = buildLambda('access-request/delete');
    accessRequestTable.grantReadWriteData(this.deleteAccessRequest);

    this.actionAccessRequest = buildLambda('access-request/action');
    accessRequestTable.grantReadWriteData(this.actionAccessRequest);
    groupTable.grantReadWriteData(this.actionAccessRequest);

    this.listUsers = buildLambda('list-users');
    this.listUsers.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [COGNITO_IDP_ACTION.ListUsers],
        resources: ['*'],
      }),
    );

    this.api.addRoutes({
      paths: {
        // /identity/request
        '/request': {
          GET: {
            integration: new LambdaIntegration(this.listAccessRequest),
            paginated: true,
            response: {
              name: 'GetAllAccessRequestOutput',
              description: 'The access requests with the given id',
              schema: {
                type: JsonSchemaType.OBJECT,
                properties: {
                  accessRequests: {
                    type: JsonSchemaType.ARRAY,
                    items: asEntity(AccessRequest),
                  },
                },
                required: ['accessRequests'],
              },
              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND],
            },
          },
          paths: {
            '/{groupId}': {
              paths: {
                // /identity/request/{groupId}/{userId}
                '/{userId}': {
                  // GET  /identity/request/{groupId}/{userId}
                  GET: {
                    integration: new LambdaIntegration(this.getAccessRequest),
                    response: {
                      name: 'GetAccessRequestOutput',
                      description: 'The access request with the given ids',
                      schema: asEntity(AccessRequest),
                      errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND],
                    },
                  },
                  // PUT  /identity/request/{groupId}/{userId}
                  PUT: {
                    integration: new LambdaIntegration(this.putAccessRequest),
                    request: {
                      name: 'PutAccessRequestInput',
                      description: 'Details about the new AccessRequest',
                      schema: {
                        ...asInput(AccessRequest),
                        required: undefined,
                      },
                    },
                    response: {
                      name: 'PutAccessRequestOutput',
                      description: 'The created/updated AccessRequest',
                      schema: asEntity(AccessRequest),
                      errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                    },
                  },
                  // DELETE /identity/request/{groupId}/{userId}
                  DELETE: {
                    integration: new LambdaIntegration(this.deleteAccessRequest),
                    response: {
                      name: 'DeleteAccessRequestTokenOutput',
                      description: 'The AccessRequest that was deleted',
                      schema: asEntity(AccessRequest),
                      errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                    },
                  },
                  paths: {
                    '/{action}': {
                      // PUT  /identity/request/{groupId}/{userId}/{action}
                      PUT: {
                        operationName: 'PutIdentityRequestAction',
                        integration: new LambdaIntegration(this.actionAccessRequest),
                        request: {
                          name: 'PutActionAccessRequestInput',
                          description: 'Approve or Deny AccessRequest',
                          schema: {
                            type: JsonSchemaType.OBJECT,
                            properties: {
                              reason: {
                                type: JsonSchemaType.STRING,
                                ...DESCRIPTION_VALIDATION,
                              },
                            },
                            required: ['reason'],
                          },
                        },
                        response: {
                          name: 'PutActionAccessRequestOutput',
                          description: 'The new details of the AccessRequest',
                          schema: {
                            type: JsonSchemaType.OBJECT,
                            properties: {
                              reason: {
                                type: JsonSchemaType.STRING,
                              },
                            },
                            required: ['reason'],
                          },
                          errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        // /identity/group
        '/group': {
          // GET /identity/group
          GET: {
            integration: new LambdaIntegration(this.listGroupLambda),
            paginated: true,
            response: {
              name: 'GetGroupsOutput',
              description: 'The list of all groups',
              schema: {
                type: JsonSchemaType.OBJECT,
                properties: {
                  groups: {
                    type: JsonSchemaType.ARRAY,
                    items: asEntity(GroupSchema),
                  },
                },
                required: ['groups'],
              },
              errorStatusCodes: [StatusCodes.BAD_REQUEST],
            },
          },
          paths: {
            // /identity/group/{groupId}
            '/{groupId}': {
              // GET /identity/group/{groupId}
              GET: {
                integration: new LambdaIntegration(this.getGroupLambda),
                response: {
                  name: 'GetGroupOutput',
                  description: 'The group with the given id',
                  schema: asEntity(GroupSchema),
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND],
                },
              },
              // DELETE /identity/group/{groupId}
              DELETE: {
                integration: new LambdaIntegration(this.deleteGroupLambda),
                response: {
                  name: 'DeleteGroupOutput',
                  description: 'The group that was deleted',
                  schema: asEntity(GroupSchema),
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                },
              },
              // PUT /identity/group/{groupId}
              PUT: {
                integration: new LambdaIntegration(this.putGroupLambda),
                request: {
                  name: 'PutGroupInput',
                  description: 'Details about the new group',
                  schema: asInput(GroupSchema, ['claims', 'apiAccessPolicyIds']),
                },
                response: {
                  name: 'PutGroupOutput',
                  description: 'The created/updated group',
                  schema: asEntity(GroupSchema),
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                },
              },
              paths: {
                // /identity/group/{groupId}/members
                '/members': {
                  PUT: {
                    integration: new LambdaIntegration(this.putGroupMembersLambda),
                    request: {
                      name: 'PutGroupMembersInput',
                      description: 'Details about the members to include',
                      schema: asNonEntityInput(GroupMembers),
                    },
                    response: {
                      name: 'PutGroupMembersOutput',
                      description: 'The updated group',
                      schema: asEntity(GroupSchema),
                      errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                    },
                  },
                },
              },
            },
          },
        },
        // /identity/machine
        '/machine': {
          // GET /identity/machine
          GET: {
            integration: new LambdaIntegration(this.listMachine),
            paginated: true,
            response: {
              name: 'GetMachinesOutput',
              description: 'The list of all machines',
              schema: {
                type: JsonSchemaType.OBJECT,
                properties: {
                  machines: {
                    type: JsonSchemaType.ARRAY,
                    items: asEntity(Machine),
                  },
                },
                required: ['machines'],
              },
              errorStatusCodes: [StatusCodes.BAD_REQUEST],
            },
          },
          paths: {
            // /identity/machine/{machineId}
            '/{machineId}': {
              paths: {
                // /identity/machine/{machineId}/token
                '/token': {
                  // GET /identity/machine/{machineId}/token
                  GET: {
                    integration: new LambdaIntegration(this.listToken),
                    paginated: true,
                    response: {
                      name: 'GetMachineTokensOutput',
                      description: 'The machine tokens with the given id',
                      schema: {
                        type: JsonSchemaType.OBJECT,
                        properties: {
                          tokens: {
                            type: JsonSchemaType.ARRAY,
                            items: asEntity(Token),
                          },
                        },
                        required: ['tokens'],
                      },
                      errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND],
                    },
                  },
                  paths: {
                    // /identity/machine/{machineId}/token/{tokenId}
                    '/{tokenId}': {
                      // GET /identity/machine/{machineId}/token/{tokenId}
                      GET: {
                        integration: new LambdaIntegration(this.getToken),
                        response: {
                          name: 'GetMachineTokenOutput',
                          description: 'The machine token with the given id',
                          schema: asEntity(Token),
                          errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND],
                        },
                      },
                      // PUT /identity/machine/{machineId}/token/{tokenId}
                      PUT: {
                        integration: new LambdaIntegration(this.putToken),
                        request: {
                          name: 'PutMachineTokenInput',
                          description: 'Details about the new machine token',
                          schema: asInput(Token, ['enabled', 'expiration']),
                        },
                        response: {
                          name: 'PutMachineTokenOutput',
                          description: 'The created/updated machine token',
                          schema: asEntity(Token),
                          errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                        },
                      },
                      // DELETE /identity/machine/{machineId}/token/{tokenId}
                      DELETE: {
                        integration: new LambdaIntegration(this.deleteToken),
                        response: {
                          name: 'DeleteMachineTokenOutput',
                          description: 'The machine token that was deleted',
                          schema: asEntity(Token),
                          errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                        },
                      },
                    },
                  },
                },
              },
              // GET /identity/machine/{machineId}
              GET: {
                integration: new LambdaIntegration(this.getMachine),
                response: {
                  name: 'GetMachineOutput',
                  description: 'The machine with the given id',
                  schema: asEntity(Machine),
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND],
                },
              },
              // DELETE /identity/machine/{machineId}
              DELETE: {
                integration: new LambdaIntegration(this.deleteMachine),
                response: {
                  name: 'DeleteMachineOutput',
                  description: 'The machine that was deleted',
                  schema: asEntity(Machine),
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                },
              },
              // PUT /identity/machine/{machineId}
              PUT: {
                integration: new LambdaIntegration(this.putMachine),
                request: {
                  name: 'PutMachineInput',
                  description: 'Details about the new machine',
                  schema: {
                    ...asInput(Machine),
                    required: undefined,
                  },
                },
                response: {
                  name: 'PutMachineOutput',
                  description: 'The created/updated machine',
                  schema: asEntity(
                    cloneSchema(Machine, {
                      id: Machine.id,
                      properties: {
                        token: {
                          type: JsonSchemaType.STRING,
                          description: 'The token to be used by the machine to do API calls',
                        },
                      },
                    }),
                  ),
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                },
              },
            },
          },
        },
        // /identity/provider
        '/provider': {
          // GET /identity/provider
          GET: {
            integration: new LambdaIntegration(this.listIdentityProvider),
            paginated: true,
            response: {
              name: 'GetProvidersOutput',
              description: 'The list of all providers',
              schema: {
                type: JsonSchemaType.OBJECT,
                properties: {
                  providers: {
                    type: JsonSchemaType.ARRAY,
                    items: asEntity(IdentityProvider),
                  },
                },
                required: ['providers'],
              },
              errorStatusCodes: [StatusCodes.BAD_REQUEST],
            },
          },
          paths: {
            '{identityProviderId}': {
              // GET /identity/provider/{identityProviderId}
              GET: {
                integration: new LambdaIntegration(this.getIdentityProvider),
                response: {
                  name: 'GetProviderOutput',
                  description: 'Details about the connected identity provider',
                  schema: asEntity(IdentityProvider),
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                },
              },
              // PUT /identity/provider/{identityProviderId}
              PUT: {
                integration: new LambdaIntegration(this.putIdentityProvider),
                request: {
                  name: 'PutProviderInput',
                  description: 'Details about the identity provider to connect',
                  schema: asInput(IdentityProvider, ['type', 'name', 'details']),
                },
                response: {
                  name: 'PutProviderOutput',
                  description: 'Details about the connected provider',
                  schema: asEntity(IdentityProvider),
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                },
              },
              DELETE: {
                integration: new LambdaIntegration(this.deleteIdentityProvider),
                response: {
                  name: 'DeleteProviderOutput',
                  description: 'Details about the deleted identity provider',
                  schema: asEntity(IdentityProvider),
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
                },
              },
            },
          },
        },
        // /identity/attributes
        '/attributes': {
          // GET /identity/attributes
          GET: {
            integration: new LambdaIntegration(this.getUserPoolAttributes),
            response: {
              name: 'GetAttributesOutput',
              description: 'Details about the identity attributes',
              schema: IdentityAttributes,
              errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND, StatusCodes.FORBIDDEN],
            },
          },
        },
        // /identity/user
        '/user': {
          GET: {
            integration: new LambdaIntegration(this.listUsers),
            paginated: true,
            requestParameters: {
              filter: {
                in: 'querystring',
                schema: { type: 'string' },
                required: false,
              },
            },
            response: {
              name: 'GetUsersOutput',
              description: 'The list of the users currently available in Cognito',
              schema: {
                type: JsonSchemaType.OBJECT,
                properties: {
                  users: {
                    type: JsonSchemaType.ARRAY,
                    items: asEntity(UserSchema),
                  },
                },
                required: ['users'],
              },
              errorStatusCodes: [StatusCodes.BAD_REQUEST],
            },
          },
        },
      },
    });

    const defaultGroups: Group[] = [
      {
        groupId: DefaultGroupIds.ADMIN,
        description: 'Administrator group',
        claims: [DefaultClaims.ROOT],
        members: [],
        // Apply all policies to admin to be provide visiblity to customer into available permissions.
        // Even though ADMINISTRATOR_ACCESS trumps all others, it is good UX to display these in UI.
        apiAccessPolicyIds: Object.values(DefaultApiAccessPolicyIds),
      },
      {
        groupId: DefaultGroupIds.POWER_USER,
        description: 'Power users, able to manage data',
        claims: [],
        members: [],
        apiAccessPolicyIds: [
          DefaultApiAccessPolicyIds.DEFAULT,
          DefaultApiAccessPolicyIds.MANAGE_DATA_PRODUCTS,
          DefaultApiAccessPolicyIds.PROGRAMMATIC_ACCESS,
        ],
      },
      {
        groupId: DefaultGroupIds.DEFAULT,
        description: 'Default users, able to read and query data',
        claims: [],
        members: [],
        apiAccessPolicyIds: [DefaultApiAccessPolicyIds.DEFAULT],
        autoAssignUsers: false,
      },
    ];

    InvokeMicroserviceLambda.makeSequential(defaultGroups.map((group) => {
      return new InvokeMicroserviceLambda(this, `CreateDefaultGroup-${group.groupId}`, {
        lambda: this.putGroupLambda,
        pathParameters: { groupId: group.groupId },
        body: group,
      });
    }));
  }
}
