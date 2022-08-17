/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AttributeType, ProjectionType } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { CountedTable } from '../../../common/constructs/dynamodb/counted-table';
import { EventSource, Microservice, MicroserviceProps } from '../../../common/services';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { TypescriptFunction } from '@ada/infra-common';
import { getUniqueName } from '@ada/cdk-core';
import NotificationApi from '../api';
import serviceConfig from '../service-config';

export type NotificationServiceStackProps = MicroserviceProps;

/**
 * Notification Service Stack
 */
export class NotificationServiceStack extends Microservice {
  readonly api: NotificationApi;

  constructor(scope: Construct, id: string, props: NotificationServiceStackProps) {
    super(scope, id, { ...props, ...serviceConfig });
    const { notificationBus, counterTable, internalTokenKey, entityManagementTables } = props;

    const notificationTable = new CountedTable(this, 'NotificationTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'target',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'notificationId',
        type: AttributeType.STRING,
      },
      counterTable,
    });

    const notificationTargetAndStatusIndexName = getUniqueName(this, 'Notification-TargetAndStatus');

    // GSI for fast retrieval of non-acknowledged notifications
    notificationTable.addGlobalSecondaryIndex({
      indexName: notificationTargetAndStatusIndexName,
      projectionType: ProjectionType.ALL,
      partitionKey: {
        name: 'targetAndStatus',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'createdTimestamp',
        type: AttributeType.STRING,
      },
    });

    const notificationLambdaEnvironment = {
      NOTIFICATION_TABLE_NAME: notificationTable.tableName,
      NOTIFICATION_TARGET_AND_STATUS_INDEX_NAME: notificationTargetAndStatusIndexName,
    };

    const notificationListenerLambda = new TypescriptFunction(this, 'NotificationListenerLambda', {
      package: 'data-product-service',
      handlerFile: require.resolve('../api/handlers/notification-listener'),
      notificationBus,
      environment: {
        ...notificationLambdaEnvironment,
      },
      counterTable,
      internalTokenKey,
      entityManagementTables,
    });
    notificationTable.grantReadWriteData(notificationListenerLambda);

    const notificationListenerRule = notificationBus.addRule('ListenToNotifications', {
      // ruleName: 'listen-to-notifications',
      notificationPattern: {
        // Listen to all event sources
        source: Object.values(EventSource),
      },
    });
    notificationListenerRule.addTarget(new LambdaFunction(notificationListenerLambda));

    this.api = new NotificationApi(this, 'Api', {
      ...serviceConfig,
      federatedApi: props.federatedApi,
      notificationTable,
      notificationLambdaEnvironment,
      counterTable,
      entityManagementTables,
    });
  }
}

export default NotificationServiceStack;
