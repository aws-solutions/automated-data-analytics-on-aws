/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { CounterTable } from '../../../common/constructs/dynamodb/counter-table';
import { EntityManagementTables } from '../../api/components/entity/constructs/entity-management-tables';
import { IdentityApi } from '../api';
import { InternalTokenKey } from '../../../common/constructs/kms/internal-token-key';
import { Microservice, MicroserviceProps } from '@ada/microservice-common';
import { NotificationBus } from '../../api/components/notification/constructs/bus';
import { OAuthScope, UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import serviceConfig from '../service-config';

export interface IdentityServiceStackProps extends MicroserviceProps {
  readonly notificationBus: NotificationBus;
  readonly userPool: UserPool;
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
  readonly callbackUrls: string[];
  readonly logoutUrls: string[];
}

/**
 * Stack for the identity microservice
 */
export class IdentityServiceStack extends Microservice {
  public readonly userPoolClient: UserPoolClient;
  public readonly oauthScopes: OAuthScope[];

  constructor(scope: Construct, id: string, props: IdentityServiceStackProps) {
    super(scope, id, { ...serviceConfig, ...props });

    this.oauthScopes = [
      OAuthScope.PHONE,
      OAuthScope.PROFILE,
      OAuthScope.OPENID,
      OAuthScope.EMAIL,
      OAuthScope.COGNITO_ADMIN,
    ];

    this.userPoolClient = new UserPoolClient(this, 'UserPoolClient', {
      userPool: props.userPool,
      authFlows: {
        userSrp: true,
      },
      generateSecret: false,
      preventUserExistenceErrors: true,
      oAuth: {
        callbackUrls: props.callbackUrls,
        logoutUrls: props.logoutUrls,
        scopes: this.oauthScopes,
        flows: {
          authorizationCodeGrant: true,
        },
      },
    });

    new IdentityApi(this, 'Api', {
      ...serviceConfig,
      ...props,
      userPoolClient: this.userPoolClient,
    });
  }
}

export default IdentityServiceStack;
