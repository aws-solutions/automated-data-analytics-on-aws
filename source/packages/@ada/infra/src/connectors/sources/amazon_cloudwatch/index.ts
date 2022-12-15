/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Connectors } from '@ada/connectors/interface';
import { DATE_VALIDATION, DataProductUpdateTriggerType } from '@ada/common';
import { PATTERN_LOGGROUP_ARN, PATTERN_QUERY, PATTERN_ROLE_ARN, TEXT_FIELD } from './constants';

export * as CONSTANT from './constants';

/**
 * Unique identitifier for this connector
 * @required
 */
export const ID = 'CLOUDWATCH' as const;

/**
 * Interface for the "sourceDetails" of data products of this connector
 * @required
 */
export interface ISourceDetails__CLOUDWATCH {
  since: string;
  until?: string;
  cloudwatchLogGroupArn: string;
  query: string;
  crossAccountRoleArn?: string;
}

/**
 * Interface for the "sourceDetails" wizard form data of data products of this connector
 * @required
 */
export type IFormData__CLOUDWATCH = Connectors.IFormData<{
  since: string;
  until?: string;
  cloudwatchLogGroupArn: string;
  query: string;
  crossAccountRoleArn?: string;
}>;

/**
 * Connector definition
 * @required
 */
export const CONNECTOR: Connectors.IConnector<ISourceDetails__CLOUDWATCH, IFormData__CLOUDWATCH> = {
  ID,
  FOLDER: 'amazon_cloudwatch',
  DOCKER_IMAGE: ['amazon-cloudwatch-connector', 'sources/amazon_cloudwatch/docker-image'] as const,

  // Interface references - used for typecasting only
  ISourceDetails: {} as ISourceDetails__CLOUDWATCH,
  ISourceDetailsFormData: {} as IFormData__CLOUDWATCH,

  METADATA: {
    label: 'Amazon CloudWatch',
    description: 'Data product from Amazon CloudWatch Log',
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
      source: {
        query: true,
      },
    },
  },

  SCHEMA: {
    id: `Connector_${ID}`,
    type: 'object',
    properties: {
      cloudwatchLogGroupArn: {
        type: 'string',
        ...PATTERN_LOGGROUP_ARN,
      },
      query: {
        type: 'string',
        ...PATTERN_QUERY,
      },
      crossAccountRoleArn: {
        type: 'string',
        ...PATTERN_ROLE_ARN,
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
    required: ['cloudwatchLogGroupArn', 'query', 'since'],
  },

  VIEW: {
    Wizard: {
      fields: [
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.cloudwatchLogGroupArn',
          label: 'CloudWatch Log Group ARN',
          description: 'Enter the Amazon CloudWatch Log Group ARN',
          placeholder: 'arn:aws:logs:<region>:<account>:log-group:/<log group name>:*',
          helperText: '',
          helperTextAsAlert: 'info',
          validate: [
            {
              type: 'required',
            },
            {
              type: 'pattern',
              pattern: PATTERN_LOGGROUP_ARN,
              message: 'Must be a valid Amazon CloudWatch Log Group ARN',
            },
          ],
        },
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.query',
          label: 'CloudWatch Query',
          description: 'Enter the query for Amazon CloudWatch Log Group ARN',
          placeholder: 'fields @timestamp, @message | sort @timestamp desc | limit 5',
          helperText: '',
          helperTextAsAlert: 'info',
          validate: [
            {
              type: 'required',
            },
            {
              type: 'pattern',
              pattern: PATTERN_QUERY,
              message: 'Must be a valid Amazon CloudWatch query pattern',
            },
          ],
        },
        {
          component: TEXT_FIELD,
          name: 'sourceDetails.crossAccountRoleArn',
          label: 'CloudWatch Logs Access IAM Role ARN',
          description:
            'Enter the arn of the IAM Role that is granted for accessing the CloudWatch Logs in the source account. The IAM role must have permission to access CloudWatch Log Group that will be imported',
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
        {
          component: 'date-picker',
          name: 'sourceDetails.since',
          label: 'Since',
          description: '',
          placeholder: 'YYYY/MM/DD',
          isRequired: true,
          isUpdateTriggerField: true,
          validate: [
            {
              type: 'required',
            },
          ],
        },
        {
          component: 'date-picker',
          name: 'sourceDetails.until',
          label: 'Until',
          description: '',
          placeholder: 'YYYY/MM/DD',
          isRequired: false,
          isUpdateTriggerField: true,
          condition: {
            when: 'updateTrigger.triggerType',
            is: DataProductUpdateTriggerType.ON_DEMAND,
          },
        },
      ],
      sourceDetailsFormDataToInputData: ({ sourceDetails }) => {
        return {
          cloudwatchLogGroupArn: sourceDetails.cloudwatchLogGroupArn,
          query: sourceDetails.query,
          since: new Date(sourceDetails.since).toISOString(),
          until: sourceDetails.until && new Date(sourceDetails.until).toISOString(),
          crossAccountRoleArn: sourceDetails.crossAccountRoleArn,
        };
      },
    },
    Summary: {
      properties: [
        { key: 'cloudwatchLogGroupArn', label: 'CloudWatch Log Group ARN' },
        { key: 'query', label: 'Query' },
        { key: 'since', label: 'Since' },
        { key: 'until', label: 'Until' },
        { key: 'crossAccountRoleArn', label: 'Cross Account Role ARN' },
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
