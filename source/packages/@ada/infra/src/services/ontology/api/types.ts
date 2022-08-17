/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DESCRIPTION_VALIDATION, ID_VALIDATION, NAME_VALIDATION } from '@ada/common';
import { JsonSchema, JsonSchemaType } from 'aws-cdk-lib/aws-apigateway';
import { LensProperty, extendSchema } from '../../../common/constructs/api';

/**
 * Identifier for an ontology attribute
 */
export const OntologyIdentifier: JsonSchema = {
  id: `${__filename}/OntologyIdentifier`,
  type: JsonSchemaType.OBJECT,
  description: 'Uniquely identifies the ontology attribute.',
  properties: {
    ontologyId: {
      type: JsonSchemaType.STRING,
      description: 'Identifies the ontology attribute within the ontologyNamespace',
      ...ID_VALIDATION,
    },
    ontologyNamespace: {
      description: 'The namespace the ontology attribute belongs to',
      type: JsonSchemaType.STRING,
      ...ID_VALIDATION,
    },
  },
  required: ['ontologyId', 'ontologyNamespace'],
};

/**
 * Schema for an ontology attribute
 */
export const Ontology: JsonSchema = extendSchema(
  {
    id: `${__filename}/Ontology`,
    type: JsonSchemaType.OBJECT,
    properties: {
      name: {
        type: JsonSchemaType.STRING,
        description: 'The name of the ontology attribute',
        ...NAME_VALIDATION,
      },
      defaultLens: LensProperty,
      description: {
        type: JsonSchemaType.STRING,
        description: 'A description of the ontology attribute',
        ...DESCRIPTION_VALIDATION,
      },
      aliases: {
        type: JsonSchemaType.ARRAY,
        description: 'Alternate names for the ontology attribute, used for ontology suggestions',
        items: {
          id: `${__filename}/OntologyAlias`,
          type: JsonSchemaType.OBJECT,
          properties: {
            name: {
              type: JsonSchemaType.STRING,
              description: 'The name of an alias for this ontology attribute',
              ...NAME_VALIDATION,
            },
          },
          required: ['name'],
        },
      },
    },
    required: ['name', 'aliases'],
  },
  OntologyIdentifier,
);
