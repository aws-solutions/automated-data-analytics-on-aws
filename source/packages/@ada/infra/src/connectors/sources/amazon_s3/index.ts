/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { BUCKET_KEY_VALIDATION, BUCKET_NAME_VALIDATION, S3Location, S3_OBJECT_PATH_REGEX } from '@ada/common';
import { Connectors } from '@ada/connectors/interface';
import { PATTERN_S3_PATH } from './constants';

export * as CONSTANT from './constants';

/**
 * Unique identitifier for this connector
 * @required
 */
export const ID = 'S3' as const;

/**
 * Interface for the "sourceDetails" of data products of this connector
 * @required
 */
export interface ISourceDetails__S3 extends S3Location {}

/**
 * Interface for the "sourceDetails" wizard form data of data products of this connector
 * @required
 */
export type IFormData__S3 = Connectors.IFormData<{
  s3Path: string;
}>;

/**
 * Connector definition
 * @required
 */
export const CONNECTOR: Connectors.IConnector<ISourceDetails__S3, IFormData__S3> = {
  ID,
  FOLDER: 'amazon_s3',

  // Interface references - used for typecasting only
  ISourceDetails: {} as ISourceDetails__S3,
  ISourceDetailsFormData: {} as IFormData__S3,

  METADATA: {
    label: 'Amazon S3',
    description: 'Data product from Amazon S3 bucket data',
    icon: ID, // NB: icons are stored in @ada/website referenced by ID
  },

  CONFIG: {
    stability: Connectors.Stability.STABLE,

    supports: {
      preview: true,
      automaticTransforms: true,
      customTransforms: true,
      updateTriggers: {
        AUTOMATIC: true,
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
      updateTriggerUpdatePolicy: {
        APPEND: true,
        REPLACE: true,
      },
      source: {
        query: true,
      },
    },
  },

  SCHEMA: {
    id: `Connector_${ID}`,
    type: 'object',
    properties: {
      bucket: {
        type: 'string',
        ...BUCKET_NAME_VALIDATION,
      },
      key: {
        type: 'string',
        ...BUCKET_KEY_VALIDATION,
      },
    },
    required: ['bucket', 'key'],
  },

  VIEW: {
    Wizard: {
      fields: [
        {
          component: 'text-field',
          name: 'sourceDetails.s3Path',
          label: 'S3 Location',
          description: 'Enter the folder location of the data in S3',
          placeholder: 's3://my-bucket/path/to/my/data',
          helperText:
            'Only folders are supported at this time; please ensure the path above is a folder and not file path. File support will be added in near future.',
          helperTextAsAlert: 'info',
          validate: [
            {
              type: 'required',
            },
            {
              type: 'pattern',
              pattern: S3_OBJECT_PATH_REGEX,
              message: 'Must be a valid s3 url, eg s3://my-bucket/path/to/my/data',
            },
          ],
        },
      ],
      sourceDetailsFormDataToInputData: ({ sourceDetails: { s3Path } }) => {
        const { bucket = '', key = '' } = PATTERN_S3_PATH.exec(s3Path)?.groups || {};

        return {
          bucket,
          key,
        };
      },
    },
    Summary: {
      properties: [
        { key: 'bucket', label: 'S3 Bucket' },
        { key: 'key', label: 'S3 Key' },
      ],
    },
  },
};

////////////////////////////////////////////////////////////////
// REGISTER CONNECTOR - DO NOT EDIT BELOW THIS LINE
////////////////////////////////////////////////////////////////
Connectors.register<typeof ID>(CONNECTOR);

export type ISourceDetails = typeof CONNECTOR['ISourceDetails'];
export type ISourceDetailsFormData = typeof CONNECTOR['ISourceDetailsFormData'];

declare module '@ada/connectors/interface' {
  interface CONNECTOR_REGISTRY {
    [ID]: typeof CONNECTOR;
  }
}
