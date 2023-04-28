/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Connectors } from '@ada/connectors/interface';
import { DATE_VALIDATION, DataProductUpdateTriggerType, GA_KV_VALIDATION } from '@ada/common';
import { GA_DIMENSIONS, GA_METRICS } from './ui-options';
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
export const ID = 'GOOGLE_ANALYTICS' as const;

/**
 * Interface for the "sourceDetails" of data products of this connector
 * @required
 */
export interface ISourceDetails__GOOGLE_ANALYTICS extends IGoogleServiceAccountAuth {
  viewId: string;
  dimensions: string;
  metrics: string;
  since?: string;
  until?: string;
  scheduleRate?: string;
  neverEnd?: boolean; // currently defaults to true
}

/**
 * Interface for the "sourceDetails" wizard form data of data products of this connector
 * @required
 */
export type IFormData__GOOGLE_ANALYTICS = Connectors.IFormData<
  Omit<ISourceDetails, 'dimensions' | 'metrics'> & {
    dimensions: { value: string }[];
    metrics: { value: string }[];
  }
>;

export const CONNECTOR: Connectors.IConnector<ISourceDetails__GOOGLE_ANALYTICS, IFormData__GOOGLE_ANALYTICS> = {
  ID,
  FOLDER: 'google_analytics',
  DOCKER_IMAGE: ['google-analytics-connector', 'sources/google_analytics/docker-image'] as const,

  // Interface references - used for typecasting only
  ISourceDetails: {} as ISourceDetails__GOOGLE_ANALYTICS,
  ISourceDetailsFormData: {} as IFormData__GOOGLE_ANALYTICS,

  METADATA: {
    label: 'Google Analytics',
    description: 'Data product from Google Analytics data',
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
        HOURLY: false,
        DAILY: true,
        WEEKLY: true,
        MONTHLY: true,
        CUSTOM: true,
      },
      updateTriggerUpdatePolicy: {
        APPEND: true,
        REPLACE: true,
      },
    },
  },

  SCHEMA: withGoogleAuthSchema({
    id: `Connector_${ID}`,
    type: 'object',
    properties: {
      viewId: {
        type: 'string',
        title: 'View Id',
        pattern: /^\d+$/.source,
      },
      dimensions: {
        type: 'string',
        ...GA_KV_VALIDATION,
        title: 'Dimensions',
      },
      metrics: {
        type: 'string',
        ...GA_KV_VALIDATION,
        title: 'Metrics',
      },
      since: {
        type: 'string',
        ...DATE_VALIDATION,
        title: 'Since',
      },
      until: {
        type: 'string',
        ...DATE_VALIDATION,
        title: 'Until',
      },
    },
    required: ['viewId', 'dimensions', 'metrics'],
  }),

  VIEW: {
    Wizard: {
      fields: [
        {
          component: 'text-field',
          name: 'sourceDetails.viewId',
          label: 'View Id',
          description: '',
          placeholder: '12345678',
          validate: [
            {
              type: 'required',
            },
            {
              type: 'pattern',
              pattern: /^\d+$/,
              message: 'Must be number',
            },
          ],
        },
        {
          component: 'select',
          name: 'sourceDetails.dimensions',
          label: 'Dimensions',
          options: GA_DIMENSIONS.map((value) => ({ value, label: value })),
          multiSelect: true,
          freeSolo: true,
          description: '',
          placeholder: 'Select from default or enter your custom dimensions',
          validate: [
            {
              type: 'required',
            },
          ],
        },
        {
          component: 'select',
          name: 'sourceDetails.metrics',
          label: 'Metrics',
          multiSelect: true,
          freeSolo: true,
          description: '',
          placeholder: 'Select from default or enter your custom metrics',
          options: GA_METRICS.map((value) => ({ value, label: value })),
          validate: [
            {
              type: 'required',
            },
          ],
        },
        {
          component: 'date-picker',
          name: 'sourceDetails.since',
          label: 'Since',
          description: '',
          placeholder: 'YYYY/MM/DD',
          isRequired: true,
          // render this field with updateTrigger fields
          isUpdateTriggerField: true,
          validate: [
            {
              type: 'required',
            },
          ],
          condition: {
            when: 'updateTrigger.triggerType',
            is: DataProductUpdateTriggerType.ON_DEMAND,
          },
        },
        {
          component: 'date-picker',
          name: 'sourceDetails.until',
          label: 'Until',
          description: '',
          placeholder: 'YYYY/MM/DD',
          isRequired: true,
          // render this field with updateTrigger fields
          isUpdateTriggerField: true,
          validate: [
            {
              type: 'required',
            },
          ],
          condition: {
            when: 'updateTrigger.triggerType',
            is: DataProductUpdateTriggerType.ON_DEMAND,
          },
        },
        ...GOOGLE_AUTH_FIELDS,
      ],
      sourceDetailsFormDataToInputData: ({ sourceDetails, updateTrigger }) => {
        return {
          ...googleAuthFormDataToInputData({ sourceDetails, updateTrigger }),
          viewId: sourceDetails.viewId,
          dimensions: sourceDetails.dimensions.map((d: { value: string }) => d.value).join(','),
          metrics: sourceDetails.metrics.map((m: { value: string }) => m.value).join(','),
          ...(updateTrigger.triggerType === DataProductUpdateTriggerType.ON_DEMAND
            ? {
                // convert the data format from iso to yyyy-MM-DD based on local date as ga does not take time stamps
                // en-ca formats the data as yyyy-MM-DD
                // scheduled import does not support start and end date form
                since: new Date(sourceDetails.since!).toLocaleDateString('en-CA'),
                until: new Date(sourceDetails.until!).toLocaleDateString('en-CA'),
              }
            : {}),
        };
      },
    },

    Summary: {
      properties: [
        { key: 'viewId', label: 'View Id' },
        { key: 'dimensions', label: 'Dimensions', valueRenderer: (value: string) => (value || '').split(',') },
        { key: 'metrics', label: 'Metrics', valueRenderer: (value: string) => (value || '').split(',') },
        { key: 'since', label: 'Since' },
        { key: 'until', label: 'Until' },
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

export type ISourceDetails = typeof CONNECTOR['ISourceDetails'];
export type ISourceDetailsFormData = typeof CONNECTOR['ISourceDetailsFormData'];

declare module '@ada/connectors/interface' {
  interface CONNECTOR_REGISTRY {
    [ID]: typeof CONNECTOR;
  }
}
