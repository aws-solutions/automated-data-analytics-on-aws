/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Connectors } from '@ada/connectors/interface';
import { DATE_VALIDATION, DataProductUpdateTriggerType } from '@ada/common';
import { PATTERN_CLOUDTRAIL_ARN, PATTERN_ROLE_ARN } from './constants';

export * as CONSTANT from './constants';

/**
 * Unique identitifier for this connector
 * @required
 */
export const ID = 'CLOUDTRAIL' as const;

/**
 * Interface for the "sourceDetails" of data products of this connector
 * @required
 */
export interface ISourceDetails__CLOUDTRAIL {
  cloudTrailEventTypes: string;
  cloudTrailTrailArn: string;
  cloudTrailDateFrom: string;
  cloudTrailDateTo?: string;
  crossAccountRoleArn?: string;
}

/**
 * Interface for the "sourceDetails" wizard form data of data products of this connector
 * @required
 */
export type IFormData__CLOUDTRAIL = Connectors.IFormData<{
  cloudTrailTrailArn: string;
  cloudTrailEventTypes: string[];
  cloudTrailDateFrom: string;
  cloudTrailDateTo?: string;
  crossAccountRoleArn?: string;
}>;

/**
 * Connector definition
 * @required
 */
export const CONNECTOR: Connectors.IConnector<ISourceDetails__CLOUDTRAIL, IFormData__CLOUDTRAIL> = {
  DOCKER_IMAGE: ['amazon-cloudtrail-connector', 'sources/amazon_cloudtrail/docker-image'] as const,
  ID,
  FOLDER: 'amazon_cloudtrail',

  // Interface references - used for typecasting only
  ISourceDetails: {} as ISourceDetails__CLOUDTRAIL,
  ISourceDetailsFormData: {} as IFormData__CLOUDTRAIL,

  METADATA: {
    label: 'Amazon CloudTrail',
    description: 'Data product from Amazon CloudTrail Trail',
    icon: ID, // NB: icons are stored in @ada/website referenced by ID
  },

  CONFIG: {
    stability: Connectors.Stability.STABLE,

    supports: {
      preview: true,
      automaticTransforms: false,
      customTransforms: true,
      disableAutomaticPii: true,
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
      source: {
        query: true,
      },
    },
  },

  SCHEMA: {
    id: `Connector_${ID}`,
    type: 'object',

    properties: {
      cloudTrailTrailArn: {
        type: 'string',
        ...PATTERN_CLOUDTRAIL_ARN,
      },
      cloudTrailEventTypes: {
        type: 'string',
      },
      cloudTrailDateFrom: {
        type: 'string',
        ...DATE_VALIDATION,
      },
      cloudTrailDateTo: {
        type: 'string',
        ...DATE_VALIDATION,
      },
      crossAccountRoleArn: {
        type: 'string',
        ...PATTERN_ROLE_ARN,
      },
    },
    required: ['cloudTrailTrailArn', 'cloudTrailEventTypes', 'cloudTrailDateFrom'],
  },

  VIEW: {
    Wizard: {
      fields: [
        {
          component: 'text-field',
          name: 'sourceDetails.cloudTrailTrailArn',
          label: 'CloudTrail Trail ARN',
          description: 'Enter the ARN for the Amazon CloudTrail trail.',
          placeholder: 'arn:aws:cloudtrail:[region]:[accountId]:trail/[name]',
          helperText:
            'This is the full ARN for the AWS CloudTrail trail, should be in the format; arn:aws:cloudtrail:[region]:[accountId]:trail/[name]',
          helperTextAsAlert: 'info',
          validate: [
            {
              type: 'required',
            },
            {
              type: 'pattern',
              pattern: PATTERN_CLOUDTRAIL_ARN,
              message: 'Must be a valid Amazon CloudTrail ARN',
            },
          ],
        },
        {
          component: 'checkbox',
          name: 'sourceDetails.cloudTrailEventTypes',
          label: 'CloudTrail Event Type(s)',
          description: 'Select which CloudTrail event type(s) you wish to import.',
          isRequired: true,
          options: [
            {
              label: 'Data Events',
              value: 'Data',
            },
            {
              label: 'Management Events',
              value: 'Management',
            },
            {
              label: 'Insight Events',
              value: 'Insight',
            },
          ],
          validate: [
            {
              type: 'required',
            },
          ],
        },
        {
          component: 'date-picker',
          name: 'sourceDetails.cloudTrailDateFrom',
          label: 'Date From',
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
          name: 'sourceDetails.cloudTrailDateTo',
          label: 'Date To',
          description: '',
          placeholder: 'YYYY/MM/DD',
          isRequired: false,
          isUpdateTriggerField: true,
          condition: {
            when: 'updateTrigger.triggerType',
            is: DataProductUpdateTriggerType.ON_DEMAND,
          },
        },
        {
          component: 'text-field',
          name: 'sourceDetails.crossAccountRoleArn',
          label: 'Cross account access Role ARN',
          description: 'Enter the ARN to enable cross account access (if required)',
          placeholder: 'arn:aws:iam::<cross account id>:role/<role name>',
          helperText:
            'If desiring to import CloudTrail logs from another AWS account(not the one ADA is installed on), please supply the Role ARN that will permit the CloudTrail connector appropriate access',
          helperTextAsAlert: 'info',
          isRequired: false,
          validate: [
            {
              type: 'pattern',
              pattern: PATTERN_ROLE_ARN,
              message: 'A valid AWS IAM Role ARN must be supplied',
            },
          ],
        },
      ],
      sourceDetailsFormDataToInputData: ({ sourceDetails }) => {
        const normaliseDate = (dateString: string): string => {
          const date = new Date(dateString);
          return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString();
        };

        return {
          cloudTrailTrailArn: sourceDetails.cloudTrailTrailArn,
          cloudTrailEventTypes: sourceDetails.cloudTrailEventTypes.join(' & ').toString(),
          cloudTrailDateFrom: normaliseDate(sourceDetails.cloudTrailDateFrom),
          cloudTrailDateTo: sourceDetails.cloudTrailDateTo && normaliseDate(sourceDetails.cloudTrailDateTo),
          crossAccountRoleArn: sourceDetails.crossAccountRoleArn,
        };
      },
    },
    Summary: {
      properties: [
        { key: 'cloudTrailTrailArn', label: 'CloudTrail Trail ARN' },
        { key: 'cloudTrailEventTypes', label: 'CloudTrail Event Type(s)' },
        { key: 'cloudTrailDateFrom', label: 'Date From' },
        { key: 'cloudTrailDateTo', label: 'Date To' },
        { key: 'crossAccountRoleArn', label: 'Cross account Role ARN permitting CloudTrail access' },
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
