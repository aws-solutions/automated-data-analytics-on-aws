/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { CounterTable } from '../../../common/constructs/dynamodb/counter-table';
import { EntityManagementTables } from '../../api/components/entity/constructs/entity-management-tables';
import { JsonSchemaType, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { MicroserviceApi, MicroserviceApiProps } from '../../../common/services';
import { PersistedNotification, PersistedNotificationStatus } from './types';
import { StatusCodes } from 'http-status-codes/build/cjs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { TypescriptFunction } from '@ada/infra-common';
import { asEntity } from '../../../common/constructs/api';

export interface NotificationApiProps extends MicroserviceApiProps {
  counterTable: CounterTable;
  notificationTable: Table;
  notificationLambdaEnvironment: { [key: string]: string };
  entityManagementTables: EntityManagementTables;
}

interface BuiltLambdaFunctions {
  listNotifications: TypescriptFunction;
  actionNotification: TypescriptFunction;
}

export default class NotificationApi extends MicroserviceApi {
  private readonly functions: BuiltLambdaFunctions;

  constructor(scope: Construct, id: string, props: NotificationApiProps) {
    super(scope, id, props);

    const buildLambda = (handlerFile: string) =>
      new TypescriptFunction(this, `Lambda-${handlerFile}`, {
        package: 'notification-service',
        handlerFile: require.resolve(`./handlers/${handlerFile}`),
        environment: {
          ...props.notificationLambdaEnvironment,
        },
        counterTable: props.counterTable,
        entityManagementTables: props.entityManagementTables,
      });

    this.functions = this.buildLambdas(buildLambda, props);

    this.addRoutes();
  }

  private buildLambdas(
    buildLambda: (handler: string) => TypescriptFunction,
    props: NotificationApiProps,
  ): BuiltLambdaFunctions {
    const listNotifications = buildLambda('list-notifications');
    props.notificationTable.grantReadData(listNotifications);
    const actionNotification = buildLambda('action-notification');
    props.notificationTable.grantReadWriteData(actionNotification);

    return {
      listNotifications,
      actionNotification,
    };
  }

  private addRoutes() {
    this.api.addRoutes({
      // GET /notification
      GET: {
        integration: new LambdaIntegration(this.functions.listNotifications),
        paginated: true,
        requestParameters: {
          status: false,
        },
        response: {
          name: 'ListNotificationsOutput',
          description: 'The notifications for the calling user (optionally filtered by status)',
          schema: {
            type: JsonSchemaType.OBJECT,
            properties: {
              notifications: {
                type: JsonSchemaType.ARRAY,
                items: asEntity(PersistedNotification),
              },
            },
            required: ['notifications'],
          },
          errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND],
        },
      },
      paths: {
        '/{notificationId}': {
          paths: {
            '/action': {
              // PUT /notification/{notificationId}/action
              PUT: {
                integration: new LambdaIntegration(this.functions.actionNotification),
                request: {
                  name: 'PutNotificationActionInput',
                  description: 'The new status to update the notification to',
                  schema: PersistedNotificationStatus,
                },
                response: {
                  name: 'PutNotificationActionOutput',
                  description: 'The notification that was actioned',
                  schema: asEntity(PersistedNotification),
                  errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.NOT_FOUND],
                },
              },
            },
          },
        },
      },
    });
  }
}
