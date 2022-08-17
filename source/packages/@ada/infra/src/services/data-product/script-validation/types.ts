/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DATE_VALIDATION, INLINE_SCRIPT_VALIDATION, asRef } from '@ada/common';
import { JsonSchema, JsonSchemaType } from 'aws-cdk-lib/aws-apigateway';

enum ScriptVulnerabilityLevelEnum {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

const ScriptVulnerabilityLevel: JsonSchema = {
  id: `${__filename}/ScriptVulnerabilityLevel`,
  type: JsonSchemaType.STRING,
  description: 'Bandit level enum',
  enum: Object.values(ScriptVulnerabilityLevelEnum),
};

export const ScriptVulnerabilityReport: JsonSchema = {
  id: `${__filename}/ScriptVulnerabilityReport`,
  type: JsonSchemaType.OBJECT,
  description: 'Bandit python vulnerability scan output',
  required: ['passed', 'errors', 'generatedAt', 'metrics', 'results'],
  properties: {
    passed: {
      type: JsonSchemaType.BOOLEAN,
    },
    errors: {
      type: JsonSchemaType.ARRAY,
      items: {
        type: JsonSchemaType.OBJECT,
      },
    },
    generatedAt: {
      type: JsonSchemaType.STRING,
      description: 'Timestamp when results were generated',
      ...DATE_VALIDATION,
    },
    metrics: {
      type: JsonSchemaType.OBJECT,
      required: ['confidence', 'severity', 'loc', 'nosec', 'skippedtests'],
      properties: {
        confidence: {
          type: JsonSchemaType.OBJECT,
          required: ['LOW', 'MEDIUM', 'HIGH'],
          properties: {
            LOW: {
              type: JsonSchemaType.INTEGER,
            },
            MEDIUM: {
              type: JsonSchemaType.INTEGER,
            },
            HIGH: {
              type: JsonSchemaType.INTEGER,
            },
          },
        },
        severity: {
          type: JsonSchemaType.OBJECT,
          required: ['LOW', 'MEDIUM', 'HIGH'],
          properties: {
            LOW: {
              type: JsonSchemaType.INTEGER,
            },
            MEDIUM: {
              type: JsonSchemaType.INTEGER,
            },
            HIGH: {
              type: JsonSchemaType.INTEGER,
            },
          },
        },
        loc: {
          type: JsonSchemaType.INTEGER,
        },
        nosec: {
          type: JsonSchemaType.INTEGER,
        },
        skippedTests: {
          type: JsonSchemaType.INTEGER,
        },
      },
    },
    results: {
      type: JsonSchemaType.ARRAY,
      items: {
        type: JsonSchemaType.OBJECT,
        required: [
          'code',
          'columnOffset',
          'filename',
          'issueConfidence',
          'issueSeverity',
          'issueText',
          'cwe',
          'lineNumber',
          'lineRange',
          'moreInfo',
          'testId',
          'testName',
        ],
        properties: {
          code: {
            type: JsonSchemaType.STRING,
          },
          columnOffset: {
            type: JsonSchemaType.INTEGER,
          },
          filename: {
            type: JsonSchemaType.STRING,
          },
          issueConfidence: asRef(ScriptVulnerabilityLevel),
          issueSeverity: asRef(ScriptVulnerabilityLevel),
          issueText: {
            type: JsonSchemaType.STRING,
          },
          cwe: {
            type: JsonSchemaType.OBJECT,
            required: ['id', 'link'],
            properties: {
              id: {
                type: JsonSchemaType.INTEGER,
              },
              link: {
                type: JsonSchemaType.STRING,
              },
            },
          },
          lineNumber: {
            type: JsonSchemaType.INTEGER,
          },
          lineRange: {
            type: JsonSchemaType.ARRAY,
            items: {
              type: JsonSchemaType.INTEGER,
            },
          },
          moreInfo: {
            type: JsonSchemaType.STRING,
          },
          testId: {
            type: JsonSchemaType.STRING,
          },
          testName: {
            type: JsonSchemaType.STRING,
          },
        },
      },
    },
  },
  definitions: {
    ScriptVulnerabilityLevel,
  },
};

export const ScriptSourceValidationInput: JsonSchema = {
  id: `${__filename}/ScriptSourceValidationInput`,
  type: JsonSchemaType.OBJECT,
  required: ['scriptSource'],
  properties: {
    scriptSource: {
      type: JsonSchemaType.STRING,
      description: 'The script source to validate',
      ...INLINE_SCRIPT_VALIDATION,
    },
  },
};

export const ScriptSourceValidationOutput: JsonSchema = {
  id: `${__filename}/ScriptSourceValidationOutput`,
  type: JsonSchemaType.OBJECT,
  required: ['scriptSource', 'report'],
  properties: {
    scriptSource: {
      type: JsonSchemaType.STRING,
      description: 'The script source that was validated',
      ...INLINE_SCRIPT_VALIDATION,
    },
    report: asRef(ScriptVulnerabilityReport),
  },
  definitions: {
    ScriptVulnerabilityReport,
  },
};
