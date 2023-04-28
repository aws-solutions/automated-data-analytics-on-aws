/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Connectors } from '@ada/connectors/interface';
import { PATTERN_DYNAMODB_TABLE_ARN, PATTERN_ROLE_ARN } from './constants';

/**
 * Unique identitifier for this connector
 * @required
 */
export const ID = 'DYNAMODB' as const;

/**
 * Interface for the "sourceDetails" of data products of this connector
 * @required
 */
export interface ISourceDetails__DYNAMODB {
  dynamoDbTableArn: string;
  crossAccountRoleArn: string;
}

/**
 * Interface for the "sourceDetails" wizard form data of data products of this connector
 * @required
 */
export type IFormData__DYNAMODB = Connectors.IFormData<{
  dynamoDbTableArn: { tableArn: string; roleArn: string };
}>;

/**
 * Connector definition
 * @required
 */
export const CONNECTOR: Connectors.IConnector<ISourceDetails__DYNAMODB, IFormData__DYNAMODB> = {
  DOCKER_IMAGE: ['amazon-dynamodb-connector', 'sources/amazon_dynamodb/docker-image'] as const,
  ID,
  FOLDER: 'amazon_dynamodb',

  // Interface references - used for typecasting only
  ISourceDetails: {} as ISourceDetails__DYNAMODB,
  ISourceDetailsFormData: {} as IFormData__DYNAMODB,

  METADATA: {
    label: 'Amazon DynamoDB',
    description: 'Data product from Amazon DynamoDB Table',
    icon: ID, // NB: icons are stored in @ada/website referenced by ID
  },

  CONFIG: {
    stability: Connectors.Stability.STABLE,

    supports: {
      preview: true,
      automaticTransforms: false, // The importer will automatically do a parquet transform
      customTransforms: true,
      updateTriggers: {
        AUTOMATIC: false,
        ON_DEMAND: true,
        SCHEDULE: true,
      },
      updateTriggerScheduleRate: {
        HOURLY: true,
        DAILY: true,
        WEEKLY: true,
        MONTHLY: true,
        CUSTOM: true,
      },
      source: {
        query: true,
      },
      updateTriggerUpdatePolicy: {
        APPEND: false,
        REPLACE: true,
      },
    },
  },

  SCHEMA: {
    id: `Connector_${ID}`,
    type: 'object',
    properties: {
      dynamoDbTableArn: {
        type: 'string',
        ...PATTERN_DYNAMODB_TABLE_ARN,
      },
      crossAccountRoleArn: {
        type: 'string',
        ...PATTERN_ROLE_ARN,
      },
    },
    required: ['dynamoDbTableArn'],
  },

  VIEW: {
    Wizard: {
      fields: [
        {
          component: 'dynamo-db-table',
          name: 'sourceDetails.dynamoDbTableArn',
          label: 'DynamoDB Table Arn',
          description: 'Enter the DynamoDB Table Arn.',
          placeholder: '<table arn>',
          helperText: '',
          helperTextAsAlert: 'info',
          initialValue: '',
          // Validation is provided by the DynamoDBTable field object natively.
        },
      ],
      sourceDetailsFormDataToInputData: ({ sourceDetails: { dynamoDbTableArn } }) => {
        return { dynamoDbTableArn: dynamoDbTableArn.tableArn, crossAccountRoleArn: dynamoDbTableArn.roleArn ?? '' };
      },
    },
    Summary: {
      properties: [
        { key: 'dynamoDbTableArn', label: 'DynamoDB Table Arn' },
        { key: 'crossAccountRoleArn', label: 'DynamoDB Role Arn for Cross account access' },
      ],
    },
  },
};

Connectors.register<typeof ID>(CONNECTOR);

export type ISourceDetails = typeof CONNECTOR['ISourceDetails'];

export type ISourceDetailsFormData = typeof CONNECTOR['ISourceDetailsFormData'];

declare module '@ada/connectors/interface' {
  interface CONNECTOR_REGISTRY {
    [ID]: typeof CONNECTOR;
  }
}
