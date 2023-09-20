/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Connectors } from '@ada/connectors/interface';
import { PATTERN_DB_PORT, PATTERN_NOT_EMPTY, PATTERN_REDSHIFT_HOST, PATTERN_ROLE_ARN, TEXT_FIELD } from './constants';

/**
 * Unique identitifier for this connector
 * @required
 */
export const ID = 'REDSHIFT' as const;

const DATABASE_TYPE_FIELD_NAME = 'sourceDetails.isRedshiftServerless';

/**
 * Interface for the "sourceDetails" of data products of this connector
 * @required
 */
export interface ISourceDetails__REDSHIFT {
  databaseEndpoint: string;
  databasePort: string;
  databaseTable: string;
  databaseName: string;
  databaseType: string;
  databaseUsername: string;
  clusterIdentifier: string;
  workgroup: string;
  crossAccountRoleArn: string;
}

/**
 * Interface for the "sourceDetails" wizard form data of data products of this connector
 * @required
 */
export type IFormData__REDSHIFT = Connectors.IFormData<{
  databaseEndpoint: string;
  databasePort: string;
  databaseName: string;
  databaseTable: string;
  isRedshiftServerless: boolean;
  databaseUsername: string;
  clusterIdentifier: string;
  workgroup: string;
  crossAccountRoleArn: string;
}>;

/**
 * Connector definition
 * @required
 */
export const CONNECTOR: Connectors.IConnector<ISourceDetails__REDSHIFT, IFormData__REDSHIFT> = {
  ID,
  FOLDER: 'amazon_redshift',
  DOCKER_IMAGE: ['amazon-redshift-connector', 'sources/amazon_redshift/docker-image'] as const,

  // Interface references - used for typecasting only
  ISourceDetails: {} as ISourceDetails__REDSHIFT,
  ISourceDetailsFormData: {} as IFormData__REDSHIFT,

  METADATA: {
    label: 'Amazon Redshift',
    description: 'Data product from Amazon Redshift cluster or Amazon Redshift Serverless',
    icon: ID, // NB: icons are stored in @ada/website referenced by ID
  },

  CONFIG: {
    stability: Connectors.Stability.STABLE,

    supports: {
      preview: true,
      automaticTransforms: false,
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
      updateTriggerUpdatePolicy: {
        APPEND: false,
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
      databaseEndpoint: {
        type: 'string',
        ...PATTERN_REDSHIFT_HOST,
      },
      databasePort: {
        type: 'string',
        ...PATTERN_DB_PORT,
      },
      databaseName: {
        type: 'string',
        ...PATTERN_NOT_EMPTY,
      },
      databaseTable: {
        type: 'string',
        ...PATTERN_NOT_EMPTY,
      },
      databaseType: {
        type: 'string',
        ...PATTERN_NOT_EMPTY,
      },
      databaseUsername: {
        type: 'string',
        ...PATTERN_NOT_EMPTY,
      },
      clusterIdentifier: {
        type: 'string',
        ...PATTERN_NOT_EMPTY,
      },
      workgroup: {
        type: 'string',
        ...PATTERN_NOT_EMPTY,
      },
      crossAccountRoleArn: {
        type: 'string',
        ...PATTERN_ROLE_ARN,
      },
    },
    required: ['databaseEndpoint', 'databasePort', 'databaseName', 'databaseTable'],
  },
  VIEW: {
    Wizard: {
      fields: [
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.databaseEndpoint',
          label: 'Redshift Endpoint',
          description:
            'Enter the endpoint for Amazon Redshift Cluster or Amazon Redshift Serverless. Ensure the network connectivity has been correctly set up.',
          placeholder: '',
          helperText: 'E.g., default.123456789012.us-east-1.redshift-serverless.amazonaws.com',
          helperTextAsAlert: 'info',
          validate: [
            {
              type: 'required',
            },
            {
              type: 'pattern',
              pattern: PATTERN_REDSHIFT_HOST,
              message: 'Must be a valid Redshift endpiont',
            },
          ],
        },
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.databasePort',
          label: 'Database Port',
          description: 'Enter the database port for Amazon Redshift cluster or Amazon Redshift Serverless',
          placeholder: '5439',
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
          placeholder: 'dev',
          helperText: '',
          helperTextAsAlert: 'info',
          validate: [
            {
              type: 'required',
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
          ],
        },
        {
          component: 'switch',
          name: DATABASE_TYPE_FIELD_NAME,
          label: 'Is the database Amazon Redshift Serverless?',
          initialValue: true,
        },
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.workgroup',
          label: 'Redshift Serverless Workgroup',
          description:
            'Enter workgroup name for Amazon Redshift Serverless',
          placeholder: 'default',
          helperText: '',
          helperTextAsAlert: 'info',
          validate: [
            {
              type: 'required',
            },
          ],
          condition: { when: DATABASE_TYPE_FIELD_NAME, is: true, then: { visible: true}, else: { visible: false } }
        },
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.databaseUsername',
          label: 'Redshift Cluster Username',
          description:
            'Enter username for Amazon Redshift Cluster',
          placeholder: 'awsuser',
          helperText: '',
          helperTextAsAlert: 'info',
          validate: [
            {
              type: 'required',
            },
          ],
          condition: { when: DATABASE_TYPE_FIELD_NAME, is: false, then: { visible: true}, else: { visible: false }  }
        },
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.clusterIdentifier',
          label: 'Redshift Cluster Identifier',
          description:
            'Enter Cluster Identifier for Amazon Redshift Cluster',
          placeholder: '',
          helperText: '',
          helperTextAsAlert: 'info',
          validate: [
            {
              type: 'required',
            },
          ],
          condition: { when: DATABASE_TYPE_FIELD_NAME, is: false, then: { visible: true}, else: { visible: false }  }
        },
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.crossAccountRoleArn',
          label: 'Redshift Cross Account Access IAM Role ARN',
          description:
            'Enter the arn of the IAM Role that is granted for accessing the Redshift in the source account. The IAM role must have permission to access Redshift database that will be imported',
          placeholder: 'arn:aws:iam::<account>:role/<rolename>',
          helperText: '',
          helperTextAsAlert: 'info',
          validate: [
            {
              type: 'pattern',
              pattern: PATTERN_ROLE_ARN,
              message: 'Must be a valid Role ARN',
            },
          ],
        },
      ],
      sourceDetailsFormDataToInputData: ({
        sourceDetails: { databaseEndpoint, databasePort, 
          databaseName, 
          databaseTable, 
          workgroup, 
          isRedshiftServerless, 
          databaseUsername, 
          clusterIdentifier, 
          crossAccountRoleArn},
      }) => {
        return {
          databaseEndpoint,
          databasePort,
          databaseName,
          databaseTable,
          databaseType: isRedshiftServerless ? 'Serverless' : 'Cluster',
          databaseUsername: databaseUsername || '',
          clusterIdentifier: clusterIdentifier || '',
          workgroup: workgroup || '',
          crossAccountRoleArn: crossAccountRoleArn || '',
        };
      },
    },
    Summary: {
      properties: [
        { key: 'databaseEndpoint', label: 'Database Endpoint' },
        { key: 'databasePort', label: 'Database Port' },
        { key: 'databaseName', label: 'Database Name' },
        { key: 'databaseTable', label: 'Database Table' },
        { key: 'databaseType', label: 'Redshift Database Type'},
        { key: 'workgroup', label: 'Redshift Serverless Workgroup' },
        { key: 'databaseUsername', label: 'Redshift Cluster Username' },
        { key: 'clusterIdentifier', label: 'Redshift Cluster Identifier' },
        { key: 'crossAccountRoleArn', label: 'IAM Role Arn for Cross account access' },
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
