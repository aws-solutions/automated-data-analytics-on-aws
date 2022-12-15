/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ARN_RESOURCE_VALIDATION } from '@ada/common';
import { Connectors } from '@ada/connectors/interface';

/**
 * Unique identitifier for this connector
 * @required
 */
export const ID = 'KINESIS' as const;

/**
 * Interface for the "sourceDetails" of data products of this connector
 * @required
 */
export interface ISourceDetails__KINESIS {
  kinesisStreamArn: string;
}

/**
 * Interface for the "sourceDetails" wizard form data of data products of this connector
 * @required
 */
export type IFormData__KINESIS = Connectors.IFormData<ISourceDetails__KINESIS>

/**
 * Connector definition
 * @required
 */
export const CONNECTOR: Connectors.IConnector<ISourceDetails__KINESIS, IFormData__KINESIS> = {
  ID,
  FOLDER: 'amazon_kinesis',

  // Interface references - used for typecasting only
  ISourceDetails: {} as ISourceDetails__KINESIS,
  ISourceDetailsFormData: {} as IFormData__KINESIS,

  METADATA: {
    label: 'Amazon Kinesis Stream',
    description: 'Data product from streaming data',
    icon: ID, // NB: icons are stored in @ada/website referenced by ID
  },

  CONFIG: {
    stability: Connectors.Stability.STABLE,

    supports: {
      preview: false,
      automaticTransforms: true,
      customTransforms: true,
      updateTriggers: {
        AUTOMATIC: true,
        ON_DEMAND: false,
        SCHEDULE: true,
      },
      updateTriggerScheduleRate: {
        HOURLY: true,
        DAILY: true,
        WEEKLY: true,
        MONTHLY: true,
        CUSTOM: true,
      },
    },
  },

  SCHEMA: {
    id: `Connector_${ID}`,
    type: 'object',
    properties: {
      kinesisStreamArn: {
        type: 'string',
        title: 'Kinesis Data Stream Arn',
        ...ARN_RESOURCE_VALIDATION,
      },
    },
    required: ['kinesisStreamArn'],
  },

  VIEW: {
    Wizard: {
      fields: [
        {
          name: 'sourceDetails.kinesisStreamArn',
          component: 'text-field',
          label: 'Kinesis Data Stream Arn',
          description: 'Enter the Arn of the Kinesis Data Stream',
          placeholder: 'arn:aws:kinesis:<region>:<account-number>:stream/<stream-name>',
          validate: [
            {
              type: 'required',
            },
            {
              type: 'pattern',
              pattern: /arn:aws:kinesis:[A-Za-z-0-9]+:\d+:stream\/[A-Za-z-0-9]+/,
              message: 'Must be a valid arn, eg. arn:aws:kinesis:<region>:<account-number>:stream/<stream-name>',
            },
          ],
        },
      ],
      sourceDetailsFormDataToInputData: ({ sourceDetails: { kinesisStreamArn } }) => ({ kinesisStreamArn }),
    },
    Summary: {
      properties: [
        { key: 'kinesisStreamArn', label: 'Kinesis Stream ARN' },
      ],
    }
  }
};

////////////////////////////////////////////////////////////////
// REGISTER CONNECTOR - DO NOT EDIT BELOW THIS LINE
////////////////////////////////////////////////////////////////
Connectors.register<typeof ID>(CONNECTOR);

export type ISourceDetails = (typeof CONNECTOR)['ISourceDetails'];
export type ISourceDetailsFormData = (typeof CONNECTOR)['ISourceDetailsFormData'];

declare module '@ada/connectors/interface' {
  interface CONNECTOR_REGISTRY {
    [ID]: typeof CONNECTOR;
  }
}
