/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { JsonSchema, JsonSchemaType } from 'aws-cdk-lib/aws-apigateway';
import { TearDownMode } from './handlers/types';

export const TearDownDetails: JsonSchema = {
  id: `${__filename}/TearDownDetails`,
  type: JsonSchemaType.OBJECT,
  properties: {
    coreStackId: {
      type: JsonSchemaType.STRING,
    },
    mode: {
      type: JsonSchemaType.STRING,
      description: 'Indicates the teardown mode being performed.',
      enum: Object.values(TearDownMode),
    },
    message: {
      type: JsonSchemaType.STRING,
    },
    retainedResources: {
      type: JsonSchemaType.ARRAY,
      description:
        'List of resource arns that will be retained after deletion has completed, unless mode is destroy data.',
      items: {
        type: JsonSchemaType.STRING,
      },
    },
  },
  required: ['coreStackId', 'mode', 'message', 'retainedResources'],
};

/**
 * Schema for an Budget attribute
 */
export const Budget: JsonSchema = {
  id: `${__filename}/Budget`,
  type: JsonSchemaType.OBJECT,
  properties: {
    budgetLimit: {
      type: JsonSchemaType.INTEGER,
    },
    subscriberList: {
      type: JsonSchemaType.ARRAY,
      description: 'Subscribers to recieve notifications',
      items: {
        type: JsonSchemaType.STRING,
      },
    },
    softNotifications: {
      type: JsonSchemaType.ARRAY,
      description: 'Soft notifications',
      items: {
        type: JsonSchemaType.INTEGER,
      },
    },
  },
  required: ['budgetLimit', 'subscriberList', 'softNotifications'],
};

export const Notification: JsonSchema = {
  id: `${__filename}/Notification`,
  type: JsonSchemaType.OBJECT,
  properties: {
    threshold: {
      type: JsonSchemaType.INTEGER,
    },
    state: {
      type: JsonSchemaType.STRING,
    },
  },
};

export const BudgetDetails: JsonSchema = {
  id: `${__filename}/BudgetDetails`,
  type: JsonSchemaType.OBJECT,
  properties: {
    budgetLimit: {
      type: JsonSchemaType.INTEGER,
    },
    actualSpend: {
      type: JsonSchemaType.INTEGER,
    },
    forecastedSpend: {
      type: JsonSchemaType.INTEGER,
    },
    subscriberList: {
      type: JsonSchemaType.ARRAY,
      description: 'Subscribers to recieve notifications',
      items: {
        type: JsonSchemaType.STRING,
      },
    },
    softNotifications: {
      type: JsonSchemaType.ARRAY,
      description: 'Soft notifications',
      items: {
        type: JsonSchemaType.OBJECT,
        properties: {
          threshold: {
            type: JsonSchemaType.INTEGER,
          },
          state: {
            type: JsonSchemaType.STRING,
          },
        },
        required: ['threshold', 'state'],
      },
    },
  },
  required: ['budgetLimit', 'actualSpend', 'forecastedSpend', 'subscriberList', 'softNotifications'],
};

export const BudgetResponse: JsonSchema = {
  id: `${__filename}/BudgetResponse`,
  type: JsonSchemaType.OBJECT,
  properties: {
    budgetName: {
      type: JsonSchemaType.STRING,
      description: 'The budget name',
    },
    message: {
      type: JsonSchemaType.STRING,
      description: 'Response message',
    },
  },
  required: ['budgetName'],
};

export const SupersetDeployResponse: JsonSchema = {
  id: `${__filename}/SupersetDeployResponse`,
  type: JsonSchemaType.OBJECT,
  properties: {
    message: {
      type: JsonSchemaType.STRING,
      description: 'Response message',
    },
  },
  required: ['message'],
};
