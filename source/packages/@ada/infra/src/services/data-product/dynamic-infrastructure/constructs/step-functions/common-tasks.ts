/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CallingUser } from '@ada/common';
import { Construct } from 'constructs';
import { DataProductEventDetailTypes, EventSource, StaticInfra } from '@ada/microservice-common';
import { EventBridgePutEvents } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { TaskInput } from 'aws-cdk-lib/aws-stepfunctions';
import type { DataProductEntity } from '@ada/api';

export interface CommonTasksProps {
  readonly callingUser: CallingUser;
  readonly dataProduct: DataProductEntity;
  readonly staticInfrastructureReferences: StaticInfra.Refs.IRecord;
  readonly additionalNotificationPayload?: { [key: string]: any };
}

export default class CommonTasks extends Construct {
  public readonly putErrorEventOnEventBridge: EventBridgePutEvents;
  public readonly putSuccessEventOnEventBridge: EventBridgePutEvents;
  public readonly putNoUpdateEventOnEventBridge: EventBridgePutEvents;

  constructor(
    scope: Construct,
    id: string,
    { dataProduct, staticInfrastructureReferences, additionalNotificationPayload, callingUser }: CommonTasksProps,
  ) {
    super(scope, id);

    const { notificationBus } = staticInfrastructureReferences;

    const putEventOnEventBridge = (payload: any, type: string, state: string) =>
      notificationBus.sendNotificationsStateMachineTask(`NotifyFor${state}`, {
        notifications: [
          {
            source: EventSource.DATA_PRODUCTS,
            type,
            payload: {
              dataProduct,
              callingUser,
              ...payload,
            },
            // Target the creator of the data product as the recipient of the notification
            target: dataProduct.createdBy,
          },
        ],
        resultPath: '$.PutEventsOutput',
      });

    this.putErrorEventOnEventBridge = putEventOnEventBridge(
      {
        executionId: TaskInput.fromJsonPathAt('$$.Execution.Id').value,
        errorDetails: TaskInput.fromJsonPathAt('$.ErrorDetails').value,
        currentPayload: TaskInput.fromJsonPathAt('$').value,
        ...additionalNotificationPayload,
      },
      DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_ERROR,
      'Error',
    );

    this.putSuccessEventOnEventBridge = putEventOnEventBridge(
      {
        dataProductCompositeIdentifier: `${dataProduct.domainId}.${dataProduct.dataProductId}`,
        tableDetails: TaskInput.fromJsonPathAt('$.Payload.tableDetails').value,
        ...additionalNotificationPayload,
      },
      DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_SUCCESS,
      'Success',
    );

    this.putNoUpdateEventOnEventBridge = putEventOnEventBridge(
      {
        dataProductCompositeIdentifier: `${dataProduct.domainId}.${dataProduct.dataProductId}`,
        ...additionalNotificationPayload,
      },
      DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_SUCCESS_NO_UPDATE,
      'SuccessNoUpdate',
    );
  }
}
