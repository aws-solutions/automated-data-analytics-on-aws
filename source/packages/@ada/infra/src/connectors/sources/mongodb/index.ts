/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  CHECKBOX_FIELD,
  PATTERN_DB_PORT,
  PATTERN_NOT_EMPTY,
  PATTERN_S3_HTTP_URI,
  SELECT_FIELD,
  SOURCE_DETAILS_TLS,
  TEXT_AREA,
  TEXT_FIELD,
} from './constants';
import { Connectors } from '@ada/connectors/interface';

/**
 * Unique identitifier for this connector
 * @required
 */
export const ID = 'MONGODB' as const;

/**
 * Interface for the "sourceDetails" of data products of this connector
 * @required
 */
export interface ISourceDetails__MONGODB {
  databaseEndpoint: string;
  databasePort: string;
  databaseName: string;
  collectionName: string;
  username: string;
  password: string;
  dbCredentialSecretName?: string;
  tlsCA?: string;
  tlsClientCert?: string;
  tlsClientCertSecretName?: string;
  tls?: string;
  extraParams?: string;
  bookmarkField?: string;
  bookmarkFieldType?: string;
}

/**
 * Interface for the "sourceDetails" wizard form data of data products of this connector
 * @required
 */
export type IFormData__MONGODB = Connectors.IFormData<{
  databaseEndpoint: string;
  databasePort: string;
  databaseName: string;
  collectionName: string;
  username: string;
  password: string;
  tlsCA?: string;
  tlsClientCert?: string;
  tls?: boolean;
  extraParams?: { value: string }[];
  bookmarkField?: string;
  bookmarkFieldType?: string;
}>;

/**
 * Connector definition
 * @required
 */
export const CONNECTOR: Connectors.IConnector<ISourceDetails__MONGODB, IFormData__MONGODB> = {
  ID,
  FOLDER: 'mongodb',
  DOCKER_IMAGE: ['mongodb-connector', 'sources/mongodb/docker-image'] as const,

  // Interface references - used for typecasting only
  ISourceDetails: {} as ISourceDetails__MONGODB,
  ISourceDetailsFormData: {} as IFormData__MONGODB,

  METADATA: {
    label: 'MongoDB',
    description: 'Data product from MongoDB database',
    icon: ID, // NB: icons are stored in @ada/website referenced by ID
  },

  CONFIG: {
    stability: Connectors.Stability.STABLE,

    managedSecret: {
      enabled: true,
      secretDetails: [
        {
          secretNameProperty: 'dbCredentialSecretName',
          secretValueProperty: 'password',
        },
        {
          secretNameProperty: 'tlsClientCertSecretName',
          secretValueProperty: 'tlsClientCert',
        },
      ],
    },

    supports: {
      preview: true,
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
        CUSTOM: true,
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
      databaseEndpoint: {
        type: 'string',
        ...PATTERN_NOT_EMPTY,
      },
      databasePort: {
        type: 'string',
        ...PATTERN_DB_PORT,
      },
      databaseName: {
        type: 'string',
        ...PATTERN_NOT_EMPTY,
      },
      collectionName: {
        type: 'string',
        ...PATTERN_NOT_EMPTY,
      },
      username: {
        type: 'string',
        ...PATTERN_NOT_EMPTY,
      },
      password: {
        type: 'string',
      },
      tls: {
        type: 'string',
      },
      tlsCA: {
        type: 'string',
      },
      tlsClientCert: {
        type: 'string',
      },
      extraParams: {
        type: 'string',
      },
      bookmarkField: {
        type: 'string',
      },
      bookmarkFieldType: {
        type: 'string',
      },
    },
    required: ['databaseEndpoint', 'databasePort', 'databaseName', 'collectionName', 'username', 'password'],
  },

  VIEW: {
    Wizard: {
      fields: [
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.databaseEndpoint',
          label: 'Database Endpoint or Host Name',
          description:
            'Enter the database endpoint or host name for the MongoDB database. Ensure the network connectivity has been correctly set up.',
          placeholder: '',
          helperText: 'Databse host name for on-premise databases or database endpoint for MongoDB instances.',
          helperTextAsAlert: 'info',
          validate: [
            {
              type: 'required',
            },
            {
              type: 'pattern',
              pattern: PATTERN_NOT_EMPTY,
              message: 'Must be a valid database endpoint',
            },
          ],
        },
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.databasePort',
          label: 'Database Port',
          description: 'Enter the database port for MongoDB database',
          placeholder: '27017',
          helperText: '',
          helperTextAsAlert: 'info',
          validate: [
            {
              type: 'required',
            },
            {
              type: 'pattern',
              pattern: PATTERN_DB_PORT,
              message: 'Must be 0 to 65535',
            },
          ],
        },
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.databaseName',
          label: 'Database Name',
          description: 'Enter the database name to be imported',
          placeholder: '',
          helperText: '',
          helperTextAsAlert: 'info',
          validate: [
            {
              type: 'required',
            },
            {
              type: 'pattern',
              pattern: PATTERN_NOT_EMPTY,
              message:
                'Must be a valid database name that consists of alphanumeric characters, dash, underscore and dot',
            },
          ],
        },
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.collectionName',
          label: 'Database Collection',
          description: 'Enter the database collection name to be imported',
          placeholder: '',
          helperText: '',
          helperTextAsAlert: 'info',
          validate: [
            {
              type: 'required',
            },
            {
              type: 'pattern',
              pattern: PATTERN_NOT_EMPTY,
              message:
                'Must be a valid database collection name that consists of alphanumeric characters, dash, underscore and dot',
            },
          ],
        },
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.username',
          label: 'Database Username',
          description: 'Username to access the database',
          placeholder: '',
          helperText: '',
          helperTextAsAlert: 'info',
          validate: [
            {
              type: 'required',
            },
            {
              type: 'pattern',
              pattern: PATTERN_NOT_EMPTY,
              message:
                'Must be a valid database user name that consists of alphanumeric characters, dash, underscore and dot',
            },
          ],
        },
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.password',
          label: 'Database Password',
          description: 'Password to access the database',
          placeholder: '',
          helperText: '',
          helperTextAsAlert: 'info',
          type: 'password',
          validate: [
            {
              type: 'required',
            },
          ],
        },
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.bookmarkField',
          label: 'Bookmark Field',
          description: 'A sortable field which will be used to bookmark the db for incremental data updates',
          placeholder: '',
          helperText: '',
          helperTextAsAlert: 'info',
          validate: [
            {
              type: 'pattern',
              pattern: PATTERN_NOT_EMPTY,
              message:
                'Must be a valid database field name that consists of alphanumeric characters, dash, underscore and dot',
            },
          ],
        },
        {
          component: SELECT_FIELD,
          name: 'sourceDetails.bookmarkFieldType',
          label: 'Bookmark Field Type',
          multiSelect: false,
          freeSolo: false,
          options: [
            { label: 'String', value: 'string' },
            { label: 'Integer', value: 'integer' },
            { label: 'Timestamp', value: 'timestamp' },
          ],
          description: '',
          placeholder: '',
        },
        {
          component: CHECKBOX_FIELD,
          name: SOURCE_DETAILS_TLS,
          label: 'TLS',
          description: 'Is TLS/SSL set on the MongoDB instance',
          isRequired: true,
        },
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.tlsCA',
          label: 'URI to fetch CA file',
          description: 'S3 or HTTP URI to download the CA file from',
          placeholder: 's3://path | https://path | http://path',
          isRequired: false,
          condition: {
            when: SOURCE_DETAILS_TLS,
            is: true,
          },
          validate: [
            {
              type: 'pattern',
              pattern: PATTERN_S3_HTTP_URI,
              message: 'Must be a valid S3, HTTP, HTTPS URI',
            },
          ],
        },
        {
          component: TEXT_AREA,
          name: 'sourceDetails.tlsClientCert',
          label: 'Client Certificate File',
          description: 'Upload the client certificate if required for the connection',
          isRequired: false,
          condition: {
            when: SOURCE_DETAILS_TLS,
            is: true,
          },
        },
        {
          component: SELECT_FIELD,
          name: 'sourceDetails.extraParams',
          label: 'Extra Parameters',
          multiSelect: true,
          freeSolo: true,
          description: '',
          placeholder: 'Enter your extra params in "key=value" form',
        },
      ],
      sourceDetailsFormDataToInputData: ({ sourceDetails }) => {
        return {
          databaseEndpoint: sourceDetails.databaseEndpoint,
          databasePort: sourceDetails.databasePort,
          databaseName: sourceDetails.databaseName,
          collectionName: sourceDetails.collectionName,
          username: sourceDetails.username,
          password: sourceDetails.password,
          tls: sourceDetails.tls?.toString() || 'false',
          tlsCA: sourceDetails.tlsCA,
          tlsClientCert: sourceDetails.tlsClientCert && encodeURIComponent(sourceDetails.tlsClientCert),
          extraParams:
            sourceDetails.extraParams && sourceDetails.extraParams.map((m: { value: string }) => m.value).join(','),
          bookmarkField: sourceDetails.bookmarkField,
          bookmarkFieldType: sourceDetails.bookmarkFieldType,
        };
      },
    },
    Summary: {
      properties: [
        { key: 'databaseEndpoint', label: 'Database Endpoint' },
        { key: 'databasePort', label: 'Database Port' },
        { key: 'databaseName', label: 'Database Name' },
        { key: 'collectionName', label: 'Database Collection' },
        { key: 'username', label: 'Database Username' },
        { key: 'password', label: 'Database Password' },
        { key: 'tls', label: 'TLS' },
        { key: 'tlsCA', label: 'CA File' },
        { key: 'tlsClientCert', label: 'Client Certificate File' },
        { key: 'extraParams', label: 'Extra Paramters' },
        { key: 'bookmarkField', label: 'Update Index Field' },
        { key: 'bookmarkFieldType', label: 'Update Index Field Type' },
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
