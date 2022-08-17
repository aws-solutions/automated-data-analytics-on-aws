/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { API_ARN_VALIDATION, DESCRIPTION_VALIDATION, ID_VALIDATION, NAME_VALIDATION } from '@ada/common';
import { JsonSchema, JsonSchemaType } from 'aws-cdk-lib/aws-apigateway';
import { asRef, extendSchema } from '../../../common/constructs/api';

export const ApiAccessPolicyIdentifier: JsonSchema = {
  id: `${__filename}/ApiAccessPolicyIdentifier`,
  type: JsonSchemaType.OBJECT,
  properties: {
    apiAccessPolicyId: {
      type: JsonSchemaType.STRING,
      description: 'Identifier for an api access policy',
      ...ID_VALIDATION,
    },
  },
  required: ['apiAccessPolicyId'],
};

/**
 * Schema for an api access policy
 */
export const ApiAccessPolicy: JsonSchema = extendSchema(
  {
    id: `${__filename}/ApiAccessPolicy`,
    type: JsonSchemaType.OBJECT,
    properties: {
      name: {
        type: JsonSchemaType.STRING,
        description: 'Name of the api access policy',
        ...NAME_VALIDATION,
      },
      description: {
        type: JsonSchemaType.STRING,
        description: 'Description of the api access policy',
        ...DESCRIPTION_VALIDATION,
      },
      resources: {
        type: JsonSchemaType.ARRAY,
        items: {
          type: JsonSchemaType.STRING,
          description: 'Resource arn for execute-api:Invoke permission associated with the policy',
          ...API_ARN_VALIDATION,
        },
      },
    },
    required: ['name', 'resources'],
  },
  ApiAccessPolicyIdentifier,
);

/**
 * The aggregated value for a metric.
 */
export const MetricValue: JsonSchema = {
  id: `${__filename}/MetricValue`,
  type: JsonSchemaType.OBJECT,
  properties: {
    amount: {
      type: JsonSchemaType.STRING,
      description: 'The actual number that represents the metric.',
    },
    unit: {
      type: JsonSchemaType.STRING,
      description: 'The unit that the metric is given in.',
    },
  },
};

export const GetCostOutput: JsonSchema = {
  id: `${__filename}/GetCostOutput`,
  type: JsonSchemaType.OBJECT,
  properties: {
    groupDefinitions: {
      type: JsonSchemaType.ARRAY,
      description: 'Group by function',
      items: {
        type: JsonSchemaType.OBJECT,
        properties: {
          type: {
            type: JsonSchemaType.STRING,
            description: 'Group Definition type. "DIMENSION"|"TAG"|"COST_CATEGORY"',
          },
          key: {
            type: JsonSchemaType.STRING,
            description: 'The key to group by',
          },
        },
      },
    },
    resultsByTime: {
      type: JsonSchemaType.ARRAY,
      description: 'Results by time',
      items: {
        type: JsonSchemaType.OBJECT,
        properties: {
          timePeriod: {
            type: JsonSchemaType.OBJECT,
            properties: {
              start: {
                type: JsonSchemaType.STRING,
                description: 'start timestamp',
              },
              end: {
                type: JsonSchemaType.STRING,
                description: 'end timestamp',
              },
            },
          },
          total: {
            type: JsonSchemaType.OBJECT,
            description: 'Total',
            properties: {
              blendedCost: {
                type: JsonSchemaType.OBJECT,
                additionalProperties: MetricValue,
              },
              usageQuantity: {
                type: JsonSchemaType.OBJECT,
                additionalProperties: MetricValue,
              },
            },
          },
          groups: {
            type: JsonSchemaType.ARRAY,
            description: 'Groups',
            items: {
              type: JsonSchemaType.OBJECT,
              properties: {
                keys: {
                  type: JsonSchemaType.ARRAY,
                  items: {
                    type: JsonSchemaType.STRING,
                  },
                },
                metrics: {
                  type: JsonSchemaType.OBJECT,
                  additionalProperties: MetricValue,
                },
              },
            },
          },
          estimated: {
            type: JsonSchemaType.BOOLEAN,
            description: 'Whether it is an estimation or not',
          },
        },
      },
    },
    dimensionValueAttributes: {
      type: JsonSchemaType.ARRAY,
      description: 'Group by function',
      items: {
        type: JsonSchemaType.OBJECT,
        properties: {
          type: {
            type: JsonSchemaType.STRING,
            description: 'Group Definition type.  "DIMENSION"|"TAG"|"COST_CATEGORY"',
          },
          key: {
            type: JsonSchemaType.STRING,
            description: 'The key to group by',
          },
        },
      },
    },
  },
  required: ['groupDefinitions', 'resultsByTime', 'dimensionValueAttributes'],
};

/**
 * Permission
 */
export const Permission: JsonSchema = {
  id: `${__filename}/Permission`,
  description: 'Define the permission for the given route',
  type: JsonSchemaType.OBJECT,
  properties: {
    access: {
      type: JsonSchemaType.BOOLEAN,
      description: 'A flag that define whether the user can call this route or not',
    },
  },
};

/**
 * User Permission
 */
export const UserPermission: JsonSchema = {
  id: `${__filename}/UserPermission`,
  description: 'Map of route by name',
  type: JsonSchemaType.OBJECT,
  additionalProperties: asRef(Permission),
  definitions: {
    Permission,
  },
};
