/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { JsonSchema, JsonSchemaType } from 'aws-cdk-lib/aws-apigateway';
import { Query, UDF } from '../../query/api/types';
import { extendSchema } from '@ada/infra-common/constructs/api';

export const QueryDiscoverOutput: JsonSchema = {
  type: JsonSchemaType.OBJECT,
  properties: {
    tables: {
      type: JsonSchemaType.ARRAY,
      items: {
        type: JsonSchemaType.OBJECT,
        properties: {
          identifierParts: {
            description: 'Each identifier part as referenced in the query',
            type: JsonSchemaType.ARRAY,
            items: {
              type: JsonSchemaType.STRING,
            },
          },
        },
        required: ['identifierParts'],
      },
    },
  },
  required: ['tables'],
};

export const QueryRewriteInput: JsonSchema = extendSchema(
  {
    id: `${__filename}/QueryRewriteInput`,
    type: JsonSchemaType.OBJECT,
    description: 'Input for a query rewrite request',
    properties: {
      dataProducts: {
        type: JsonSchemaType.OBJECT,
        description:
          'Map of data product (as referenced in the query) to details about the data product for governance',
        additionalProperties: {
          type: JsonSchemaType.OBJECT,
          properties: {
            tableName: {
              type: JsonSchemaType.STRING,
              description: 'The qualified table name referencable in Athena',
            },
            columns: {
              type: JsonSchemaType.ARRAY,
              items: {
                type: JsonSchemaType.OBJECT,
                properties: {
                  name: {
                    type: JsonSchemaType.STRING,
                    description: 'Column name',
                  },
                  attribute: {
                    type: JsonSchemaType.STRING,
                    description: 'Optional ontology attribute associated with this column',
                  },
                  udfs: {
                    type: JsonSchemaType.ARRAY,
                    description: 'User-defined functions to apply to this column for governance',
                    items: UDF,
                  },
                  clauses: {
                    type: JsonSchemaType.ARRAY,
                    description:
                      'Additional SQL where clauses to apply for this column (written in terms of the ontology attribute)',
                    items: { type: JsonSchemaType.STRING },
                  },
                },
                // Attribute not required as some columns may not map to an attribute
                // Empty array is passed when there are no udfs/clauses
                required: ['name', 'udfs', 'clauses'],
              },
            },
          },
          required: ['tableName', 'columns'],
        },
      },
      querySubstitutions: {
        type: JsonSchemaType.OBJECT,
        description:
          'A map of query name (as referenced in the input query) to the query to be substituted. Recursive references are allowed so long as they are not circular.',
        additionalProperties: {
          type: JsonSchemaType.OBJECT,
          properties: {
            query: {
              type: JsonSchemaType.STRING,
            },
          },
        },
      },
    },
    required: ['dataProducts'],
  },
  Query,
);

export const ValidateAttributeValuePolicyInput: JsonSchema = {
  type: JsonSchemaType.OBJECT,
  properties: {
    attribute: {
      type: JsonSchemaType.STRING,
      description: 'The attribute to be replaced in the sql clause',
    },
    clause: {
      type: JsonSchemaType.STRING,
      description: 'The SQL clause to validate',
    },
  },
  required: ['attribute', 'clause'],
};

export const ValidateAttributeValuePolicyOutput: JsonSchema = {
  type: JsonSchemaType.OBJECT,
  // Empty response for now - an error response is used for validation failures
  properties: {},
};
