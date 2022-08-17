/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AdaUserPoolProps } from '../../../nested-stacks/cognito-auth-stack';
import { ApiAccessPolicyRoutes } from './routes/api-access-policy';
import { AttributeType, ProjectionType } from 'aws-cdk-lib/aws-dynamodb';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { Bucket } from '../../../common/constructs/s3/bucket';
import { CfnResource, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CostApiRoutes } from './routes/cost';
import { CountedTable } from '../../../common/constructs/dynamodb/counted-table';
import { CounterTable } from '../../../common/constructs/dynamodb/counter-table';
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { EntityManagementTables } from '../components/entity/constructs/entity-management-tables';
import { FederatedRestApi } from '../../../common/constructs/api/federated-api';
import { IdentitySource, RequestAuthorizer } from 'aws-cdk-lib/aws-apigateway';
import { InternalTokenKey } from '../../../common/constructs/kms/internal-token-key';
import { NotificationBus } from '../components/notification/constructs/bus';
import { PermissionsApiRoutes } from './routes/permissions';
import { TypescriptFunction } from '@ada/infra-common';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { addCfnNagSuppressions, getUniqueName } from '@ada/cdk-core';

export interface FederatedApiProps {
  adaUserPoolProps: AdaUserPoolProps;
  userPool: UserPool;
  autoAssociateAdmin: string;
  adminEmailAddress: string;
  notificationBus: NotificationBus;
  counterTable: CounterTable;
  internalTokenKey: InternalTokenKey;
  entityManagementTables: EntityManagementTables;
  accessLogsBucket: Bucket;
  userIdScope: string;
  cognitoDomain: string;
}

/**
 * Federated API Service - unified api for all of Ada
 */
export class FederatedApi extends Construct {
  readonly federatedApi: FederatedRestApi;

  public readonly machineTable: CountedTable;
  public readonly tokenTable: CountedTable;
  public readonly groupTable: CountedTable;
  public readonly apiAccessPolicyTable: CountedTable;
  public readonly accessRequestTable: CountedTable;

  constructor(scope: Construct, id: string, props: FederatedApiProps) {
    super(scope, id);

    const {
      userPool,
      autoAssociateAdmin,
      adminEmailAddress,
      counterTable,
      internalTokenKey,
      entityManagementTables,
      adaUserPoolProps,
      accessLogsBucket,
      userIdScope,
      cognitoDomain,
    } = props;

    // moved tables here to avoid circular dependency between api and custom authorizer

    this.machineTable = new CountedTable(this, 'IdentityMachineTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'machineId',
        type: AttributeType.STRING,
      },
      counterTable,
    });

    this.tokenTable = new CountedTable(this, 'IdentityMachineTokenTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'machineId',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'tokenId',
        type: AttributeType.STRING,
      },
      counterTable,
    });

    const tokenClientIdIndexName = getUniqueName(this, 'Token-ClientId');

    // GSI for fast retrieval of tokens based on clientId
    this.tokenTable.addGlobalSecondaryIndex({
      indexName: tokenClientIdIndexName,
      projectionType: ProjectionType.ALL,
      partitionKey: {
        name: 'clientId',
        type: AttributeType.STRING,
      },
    });

    this.accessRequestTable = new CountedTable(this, 'AccessRequestTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'groupId',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'userId',
        type: AttributeType.STRING,
      },
      counterTable,
    });

    this.groupTable = new CountedTable(this, 'GroupsTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'groupId',
        type: AttributeType.STRING,
      },
      counterTable,
    });

    this.apiAccessPolicyTable = new CountedTable(this, 'ApiAccessPolicyTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'apiAccessPolicyId',
        type: AttributeType.STRING,
      },
      counterTable,
    });

    const customAuthorizerHandler = new TypescriptFunction(this, 'CustomAuthorizer', {
      package: 'api-service',
      handlerFile: require.resolve('./handlers/custom-authorizer'),
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        API_ACCESS_POLICY_TABLE_NAME: this.apiAccessPolicyTable.tableName,
        GROUP_TABLE_NAME: this.groupTable.tableName,
        TOKEN_TABLE_NAME: this.tokenTable.tableName,
        TOKEN_CLIENT_ID_INDEX_NAME: tokenClientIdIndexName,
        COGNITO_DOMAIN: cognitoDomain,
        USER_ID_SCOPE: userIdScope,
      },
      counterTable,
      internalTokenKey,
    });
    customAuthorizerHandler.addToRolePolicy(
      new PolicyStatement({
        actions: ['cognito-idp:AdminGetUser'],
        resources: [userPool.userPoolArn],
        effect: Effect.ALLOW,
      }),
    );
    this.apiAccessPolicyTable.grantReadData(customAuthorizerHandler);
    this.groupTable.grantReadData(customAuthorizerHandler);
    this.tokenTable.grantReadData(customAuthorizerHandler);

    const customAuthorizer = new RequestAuthorizer(this, 'CustomAuthorizerHandler', {
      handler: customAuthorizerHandler,
      identitySources: [IdentitySource.header('Authorization')],
      // 15 minutes as default cache time
      resultsCacheTtl: Duration.minutes(15),
    });

    this.federatedApi = new FederatedRestApi(this, 'FederatedRestApi', {
      customAuthorizer,
      accessLogsBucket,
    });

    customAuthorizerHandler.addEnvironment(
      'DEFAULT_ACCESS_POLICIES',
      [
        // list the available groups
        this.federatedApi.arnForExecuteApi('GET', '/identity/group', '*'),
        // request access to a specific group /identity/request/{groupId}/{userId}
        this.federatedApi.arnForExecuteApi('PUT', '/identity/request/*/*', '*'),
      ].join(','),
    );

    new ApiAccessPolicyRoutes(this, 'ApiAccessPolicyRoutes', {
      api: this.federatedApi,
      apiAccessPolicyTable: this.apiAccessPolicyTable,
      counterTable,
      entityManagementTables,
      internalTokenKey,
    });
    new CostApiRoutes(this, 'CostApiRoutes', { api: this.federatedApi, entityManagementTables, internalTokenKey });
    new PermissionsApiRoutes(this, 'PermissionsApiRoutes', {
      api: this.federatedApi,
      entityManagementTables,
      internalTokenKey,
      groupTable: this.groupTable,
      apiAccessPolicyTable: this.apiAccessPolicyTable,
      userPool,
    });

    const preTokenGenerationLambdaTrigger = new TypescriptFunction(this, 'pretoken-generation-trigger', {
      package: 'api-service',
      handlerFile: require.resolve('./handlers/pretoken-generation-trigger'),
      environment: {
        AUTO_ASSOCIATE_ADMIN: autoAssociateAdmin,
        ADMIN_EMAIL: adminEmailAddress,
        GROUP_TABLE_NAME: this.groupTable.tableName,
        USER_POOL_ID: userPool.userPoolId,
      },
      counterTable,
    });
    // add permission for cognito user pool to invoke the Lambda
    const cognitoIdpInvokePermissionId = 'CognitoIdpInvokePermission';
    preTokenGenerationLambdaTrigger.addPermission(cognitoIdpInvokePermissionId, {
      principal: new ServicePrincipal('cognito-idp.amazonaws.com'),
      action: 'lambda:invokeFunction',
      sourceArn: userPool.userPoolArn,
    });
    addCfnNagSuppressions(preTokenGenerationLambdaTrigger.node.findChild(cognitoIdpInvokePermissionId) as CfnResource, [
      {
        id: 'W24',
        reason: 'InvokeFunction permissions are intentionally granted.',
      },
    ]);
    preTokenGenerationLambdaTrigger.addToRolePolicy(
      new PolicyStatement({
        actions: ['cognito-idp:AdminUpdateUserAttributes'],
        resources: [userPool.userPoolArn],
        effect: Effect.ALLOW,
      }),
    );
    this.groupTable.grantReadData(preTokenGenerationLambdaTrigger);

    // use this to avoid circular dependency and limitation of IUserPool not having .addTrigger
    // https://github.com/aws/aws-cdk/issues/10002
    new AwsCustomResource(this, 'UpdateUserPool', {
      onUpdate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'updateUserPool',
        parameters: {
          UserPoolId: userPool.userPoolId,
          LambdaConfig: {
            PreTokenGeneration: preTokenGenerationLambdaTrigger.functionArn,
          },
          AdminCreateUserConfig: {
            AllowAdminCreateUserOnly: !adaUserPoolProps.selfSignUpEnabled,
          },
          UserPoolAddOns: {
            AdvancedSecurityMode: adaUserPoolProps.advancedSecurityMode,
          },
        },
        // to force deployment
        physicalResourceId: PhysicalResourceId.of(`UpdateUserPool-${Date.now()}`),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: [userPool.userPoolArn],
      }),
    });
  }
}

export default FederatedApi;
