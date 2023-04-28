/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Connectors } from '@ada/connectors/interface';
import {
  GOOGLE_AUTH_FIELDS,
  IGoogleServiceAccountAuth,
  googleAuthFormDataToInputData,
  withGoogleAuthSchema,
} from '@ada/connectors/common/google/definition';

/**
 * Unique identitifier for this connector
 * @required
 */
export const ID = 'GOOGLE_BIGQUERY' as const;

/**
 * Interface for the "sourceDetails" of data products of this connector
 * @required
 */
export interface ISourceDetails__GOOGLE_BIGQUERY extends IGoogleServiceAccountAuth {
  query: string;
}

/**
 * Interface for the "sourceDetails" wizard form data of data products of this connector
 * @required
 */
 export type IFormData__GOOGLE_BIGQUERY = Connectors.IFormData<ISourceDetails__GOOGLE_BIGQUERY>

export const CONNECTOR: Connectors.IConnector<ISourceDetails__GOOGLE_BIGQUERY, IFormData__GOOGLE_BIGQUERY> = {
  ID,
  FOLDER: 'google_bigquery',
  DOCKER_IMAGE: ['google-bigquery-connector', 'sources/google_bigquery/docker-image'] as const,

  // Interface references - used for typecasting only
  ISourceDetails: {} as ISourceDetails__GOOGLE_BIGQUERY,
  ISourceDetailsFormData: {} as IFormData__GOOGLE_BIGQUERY,

  METADATA: {
    label: 'Google BigQuery',
    description: 'Data product from Google BigQuery data',
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
        CUSTOM: false,
      },
    },
  },

  SCHEMA: withGoogleAuthSchema({
    id: `Connector_${ID}`,
    type: 'object',
    properties: {
      query: {
        type: 'string',
        'ui:widget': 'sql-editor',
      },
    },
    required: ['query'],
  }),

  VIEW: {
    Wizard: {
      fields: [
        {
          component: 'code-editor',
          name: 'sourceDetails.query',
          label: 'Query',
          description: 'Enter the query to be executed in BigQuery to retrieve the data',
          hintText: `SELECT state_name, country\nFROM \`table-project-id\`.\`data-set-name\`.\`table-name\`\nWHERE country = "US"`,
          maxLines: 10,
          mode: 'sql',
          validate: [
            {
              type: 'required',
            },
          ],
        },
        ...GOOGLE_AUTH_FIELDS,
      ],
      sourceDetailsFormDataToInputData: ({ sourceDetails, updateTrigger }) => {
        return {
          ...googleAuthFormDataToInputData({ sourceDetails, updateTrigger }),
          query: sourceDetails.query,
        };
      },
    },

    Summary: {
      properties: [
        { key: 'query', label: 'Query' },
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
