/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Connectors } from '@ada/connectors/interface';
import { ISourceDetails__JDBC } from '@ada/connectors/common/jdbc/types';
import { PATTERN_DB_PORT, PATTERN_NOT_EMPTY, TEXT_FIELD } from './constants';

/**
 * Unique identitifier for this connector
 * @required
 */
export const ID = 'POSTGRESQL' as const;

/**
 * Interface for the "sourceDetails" of data products of this connector
 * @required
 */
export interface ISourceDetails__POSTGRESQL extends ISourceDetails__JDBC {}

/**
 * Interface for the "sourceDetails" wizard form data of data products of this connector
 * @required
 */
export type IFormData__POSTGRESQL = Connectors.IFormData<{
  databaseEndpoint: string;
  databasePort: string;
  databaseEngine: string;
  databaseSchema: string;
  databaseTable: string;
  databaseName: string;
  username: string;
  password: string;
}>;

/**
 * Connector definition
 * @required
 */
export const CONNECTOR: Connectors.IConnector<ISourceDetails__POSTGRESQL, IFormData__POSTGRESQL> = {
  ID,
  FOLDER: 'jdbc_postgresql',

  // Interface references - used for typecasting only
  ISourceDetails: {} as ISourceDetails__POSTGRESQL,
  ISourceDetailsFormData: {} as IFormData__POSTGRESQL,

  METADATA: {
    label: 'PostgreSQL',
    description: 'Data product from PostgreSQL database',
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
        query: false,
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
      databaseSchema: {
        type: 'string',
        ...PATTERN_NOT_EMPTY,
      },
      databaseTable: {
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
    },
    required: [
      'databaseEndpoint',
      'databasePort',
      'databaseName',
      'databaseSchema',
      'databaseTable',
      'username',
      'password',
    ],
  },

  VIEW: {
    Wizard: {
      fields: [
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.databaseEndpoint',
          label: 'Database Endpoint or Host Name',
          description:
            'Enter the database endpoint or host name for the PostgreSQL database. Ensure the network connectivity has been correctly set up.',
          placeholder: '',
          helperText:
            'Databse host name for on-premise databases or database endpoint for AWS RDS instances. Support up to PostgresSQL 13.',
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
          description: 'Enter the database port for PostgreSQL database',
          placeholder: '5432',
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
          description: 'Enter the name of the database to be imported',
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
          name: 'sourceDetails.databaseSchema',
          label: 'Database Schema',
          description: 'Enter the schema of the table to be imported from the database',
          placeholder: 'public',
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
                'Must be a valid database schema name that consists of alphanumeric characters, dash, underscore and dot',
            },
          ],
        },
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.databaseTable',
          label: 'Database Table',
          description: 'Enter the name of the table to be imported from the database',
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
                'Must be a valid database table name that consists of alphanumeric characters, dash, underscore and dot',
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
      ],
      sourceDetailsFormDataToInputData: ({
        sourceDetails: {
          databaseEndpoint,
          databasePort,
          databaseName,
          databaseSchema,
          databaseTable,
          username,
          password,
        },
      }) => {
        return {
          databaseEndpoint,
          databasePort,
          databaseName,
          databaseSchema,
          databaseTable,
          username,
          password,
        };
      },
    },
    Summary: {
      properties: [
        { key: 'databaseEndpoint', label: 'Database Endpoint' },
        { key: 'databasePort', label: 'Database Port' },
        { key: 'databaseName', label: 'Database Name' },
        { key: 'databaseSchema', label: 'Database Schema' },
        { key: 'databaseTable', label: 'Database Table' },
        { key: 'username', label: 'Database Username' },
        { key: 'password', label: 'Database Password' },
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
