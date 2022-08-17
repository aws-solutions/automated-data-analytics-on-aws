/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ID_VALIDATION, NAME_VALIDATION } from '@ada/common';
import { JsonSchema, JsonSchemaType } from 'aws-cdk-lib/aws-apigateway';
import { extendSchema } from '../../../common/constructs/api';

export const PersistedNotificationIdentifier: JsonSchema = {
  id: `${__filename}/PersistedNotificationIdentifier`,
  type: JsonSchemaType.OBJECT,
  properties: {
    notificationId: {
      type: JsonSchemaType.STRING,
      ...ID_VALIDATION,
    },
    target: {
      type: JsonSchemaType.STRING,
      description: 'The target of the notification, for example the userId',
      ...NAME_VALIDATION,
    },
  },
  required: ['notificationId', 'target'],
};

/**
 * Schema for a notification to send
 */
export const Notification: JsonSchema = {
  id: `${__filename}/Notification`,
  type: JsonSchemaType.OBJECT,
  description: 'A notification as sent throughout the system',
  properties: {
    source: {
      type: JsonSchemaType.STRING,
      ...NAME_VALIDATION,
    },
    type: {
      type: JsonSchemaType.STRING,
      ...NAME_VALIDATION,
    },
    target: {
      type: JsonSchemaType.STRING,
      description: 'Specified if the notification should target a particular recipient, for example a user id.',
      ...NAME_VALIDATION,
    },
    payload: {
      description: 'Payload to send in the notification, can be any object',
    },
  },
  required: ['source', 'type', 'payload'],
};

export const PersistedNotificationStatus: JsonSchema = {
  id: `${__filename}/PersistedNotificationStatus`,
  type: JsonSchemaType.OBJECT,
  description: 'An object containing a persisted notification status',
  properties: {
    status: {
      type: JsonSchemaType.STRING,
      enum: ['PENDING', 'ACKNOWLEDGED', 'DISMISSED'],
    },
  },
  required: ['status'],
};

export const PersistedNotification: JsonSchema = extendSchema(
  {
    id: `${__filename}/PersistedNotification`,
    type: JsonSchemaType.OBJECT,
    description: 'A notification as stored',
    properties: {
      targetAndStatus: {
        type: JsonSchemaType.STRING,
        description: 'Composite key for index of notification by target and status. Delimited by .',
        ...NAME_VALIDATION,
      },
    },
    required: ['targetAndStatus'],
  },
  PersistedNotificationIdentifier,
  PersistedNotificationStatus,
  Notification,
);
