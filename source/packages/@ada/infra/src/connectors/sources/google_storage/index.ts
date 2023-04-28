/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { BUCKET_KEY_VALIDATION, BUCKET_NAME_VALIDATION, GOOGLE_STORAGE_PATH_REGEX, GSLocation } from '@ada/common';
import { Connectors } from '@ada/connectors/interface';
import {
  GOOGLE_AUTH_FIELDS,
  IGoogleServiceAccountAuth,
  googleAuthFormDataToInputData,
  withGoogleAuthSchema,
} from '@ada/connectors/common/google/definition';
import { PATTERN_GS_PATH } from './constants';

export * as CONSTANT from './constants';

/**
 * Unique identitifier for this connector
 * @required
 */
export const ID = 'GOOGLE_STORAGE' as const;

/**
 * Interface for the "sourceDetails" of data products of this connector
 * @required
 */
export interface ISourceDetails__GOOGLE_STORAGE extends IGoogleServiceAccountAuth, GSLocation {}

/**
 * Interface for the "sourceDetails" wizard form data of data products of this connector
 * @required
 */
 export type IFormData__GOOGLE_STORAGE = Connectors.IFormData<Omit<ISourceDetails__GOOGLE_STORAGE, 'bucket' | 'key'> & {
  googleStoragePath: string;
}>


export const CONNECTOR: Connectors.IConnector<ISourceDetails__GOOGLE_STORAGE, IFormData__GOOGLE_STORAGE> = {
  ID,
  FOLDER: 'google_storage',
  DOCKER_IMAGE: ['google-storage-connector', 'sources/google_storage/docker-image'] as const,

  // Interface references - used for typecasting only
  ISourceDetails: {} as ISourceDetails__GOOGLE_STORAGE,
  ISourceDetailsFormData: {} as IFormData__GOOGLE_STORAGE,

  METADATA: {
    label: 'Google Storage',
    description: 'Data product from Google Storage data',
    icon: ID, // NB: icons are stored in @ada/website referenced by ID
  },

  CONFIG: {
    stability: Connectors.Stability.STABLE,

    managedSecret: {
      enabled: true,
      secretDetails: [
        {
          secretNameProperty: 'privateKeySecretName',
          secretValueProperty: 'privateKey',
        },
      ],
    },

    supports: {
      // TODO: there is a bug in preview/pull_samples for this connector (known in GA launch) so disabled until resolved
      preview: false,
      automaticTransforms: true,
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
        CUSTOM: false,
      },
    },
  },

  SCHEMA: withGoogleAuthSchema({
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
  }),

  VIEW: {
    Wizard: {
      fields: [
        {
          component: 'text-field',
          name: 'sourceDetails.googleStoragePath',
          label: 'Google Storage Location',
          description: 'Enter the folder path of the data in Google Storage',
          placeholder: 'gs://my-bucket/path/to/my/data (folder)',
          helperText:
            'Only folders are supported at this time; please ensure the path above is a folder and not file path. File support will be added in near future.',
          validate: [
            {
              type: 'required',
            },
            {
              type: 'pattern',
              pattern: GOOGLE_STORAGE_PATH_REGEX,
              message: 'Must be a valid Google Storage url, eg gs://my-bucket/path/to/my/data',
            },
          ],
        },
        ...GOOGLE_AUTH_FIELDS,
      ],
      sourceDetailsFormDataToInputData: ({ sourceDetails, updateTrigger }) => {
        const { bucket = '', key = '' } = PATTERN_GS_PATH.exec(sourceDetails.googleStoragePath)?.groups || {};

        return {
          ...googleAuthFormDataToInputData({ sourceDetails, updateTrigger }),
          bucket,
          key,
        };
      },
    },

    Summary: {
      properties: [
        { key: 'bucket', label: 'Bucket' },
        { key: 'key', label: 'Key' },
        { key: 'projectId', label: 'Project Id' },
        { key: 'clientId', label: 'Client Id' },
      ],
    },
  },
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
