/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  BUCKET_KEY_VALIDATION,
  BUCKET_NAME_VALIDATION,
  FILEUPLOAD_SUPPORTED_EXTENSIONS,
  JsonSchemaType,
  S3Location,
} from '@ada/common';
import { Connectors } from '@ada/connectors/interface';
import { UPLOAD_FILE_WIZARD_FIELD } from './constants';

export * as CONSTANT from './constants';

/**
 * Unique identitifier for this connector
 * @required
 */
export const ID = 'UPLOAD' as const;

/**
 * Interface for the "sourceDetails" of data products of this connector
 * @required
 */
export interface ISourceDetails__UPLOAD extends S3Location {}

/**
 * Interface for the "sourceDetails" wizard form data of data products of this connector
 * @required
 */
export type IFormData__UPLOAD = Connectors.IFormData<ISourceDetails__UPLOAD>

export const CONNECTOR: Connectors.IConnector<ISourceDetails__UPLOAD, IFormData__UPLOAD> = {
  ID,
  FOLDER: 'file_upload',

  // Interface references - used for typecasting only
  ISourceDetails: {} as ISourceDetails__UPLOAD,
  ISourceDetailsFormData: {} as IFormData__UPLOAD,

  METADATA: {
    label: 'File Upload',
    description: 'Data product from uploading a data file',
    icon: ID, // NB: icons are stored in @ada/website referenced by ID
  },

  CONFIG: {
    stability: Connectors.Stability.STABLE,

    supports: {
      preview: true,
      automaticTransforms: true,
      customTransforms: true,
      updateTriggers: false,
      updateTriggerScheduleRate: null,
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
        type: JsonSchemaType.STRING,
        ...BUCKET_NAME_VALIDATION,
      },
      key: {
        type: JsonSchemaType.STRING,
        ...BUCKET_KEY_VALIDATION,
      },
    },
    required: ['bucket', 'key'],
  },

  VIEW: {
    Wizard: {
      fields: [
        {
          component: 'file-upload',
          name: UPLOAD_FILE_WIZARD_FIELD,
          label: 'Source File',
          description: 'Upload the file that contains the data you would like to query',
          accept: FILEUPLOAD_SUPPORTED_EXTENSIONS,
          isRequired: true,
          validate: [
            {
              type: 'required',
            },
          ],
        },
      ],
      sourceDetailsFormDataToInputData: ({ sourceDetails: { bucket, key } }) => ({ bucket, key }),
    },

    Summary: {
      properties: [
        { key: 'bucket', label: 'S3 Bucket' },
        { key: 'key', label: 'S3 Key' },
      ],
    },
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
