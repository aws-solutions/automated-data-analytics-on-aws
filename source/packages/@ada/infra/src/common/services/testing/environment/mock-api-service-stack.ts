/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket } from '../../../../common/constructs/s3/bucket';
import { Construct } from 'constructs';
import { CounterTable } from '../../../../common/constructs/dynamodb/counter-table';
import { EntityManagementTables } from '../../../../services/api/components/entity/constructs/entity-management-tables';
import { FederatedRestApi } from '../../../constructs/api';
import { InternalTokenKey } from '../../../../common/constructs/kms/internal-token-key';
import { NotificationBus } from '../../../../services/api/components/notification/constructs/bus';
import { TestStack } from '@ada/cdk-core';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import ApiServiceStack from '../../../../services/api/stack';

/**
 * Test stack that includes mocked ApiServiceStack and exposes common
 * test environment resources to map to Cdk testing environment.
 */
export class TestStackWithMockedApiService extends TestStack {
  readonly userPool: UserPool;
  readonly counterTable: CounterTable;
  readonly entityManagementTables: EntityManagementTables;
  readonly internalTokenKey: InternalTokenKey;
  readonly notificationBus: NotificationBus;
  readonly accessLogsBucket: Bucket;
  readonly apiService: ApiServiceStack;
  readonly federatedApi: FederatedRestApi;

  constructor(scope?: Construct, id?: string) {
    super(scope, id);

    this.userPool = new UserPool(this, 'UserPool', {});

    this.counterTable = new CounterTable(this, 'CounterTable', {
      partitionKey: {
        name: 'tableName',
        type: AttributeType.STRING,
      },
    });

    this.entityManagementTables = new EntityManagementTables(this, 'EntityManagementTables');
    this.internalTokenKey = new InternalTokenKey(this, 'internal-token', {
      keyAlias: 'internal-token-key',
      secretName: 'test-secret-tname',
    });
    this.notificationBus = new NotificationBus(this, 'notification-bus');

    this.accessLogsBucket = new Bucket(this, 'AccessBucket', {});

    this.apiService = new ApiServiceStack(this, 'Api', {
      adaUserPoolProps: {
        advancedSecurityMode: 'ENFORCED',
        selfSignUpEnabled: false,
      },
      userPool: this.userPool,
      autoAssociateAdmin: '',
      adminEmailAddress: '',
      internalTokenKey: this.internalTokenKey,
      userIdScope: 'ada/test-scope',
      counterTable: this.counterTable,
      cognitoDomain: 'test-domain.auth.ap-southeast-2.amazoncognito.com',
      accessLogsBucket: this.accessLogsBucket,
      notificationBus: this.notificationBus,
      entityManagementTables: this.entityManagementTables,
    });

    this.federatedApi = this.apiService.api;
  }
}
