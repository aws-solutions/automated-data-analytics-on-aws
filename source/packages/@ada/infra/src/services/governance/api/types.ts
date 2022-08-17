/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AccessProperty, LensProperty, asRef, extendSchema } from '../../../common/constructs/api';
import { DESCRIPTION_VALIDATION, ID_VALIDATION, NAMESPACED_ID_VALIDATION, SQL_CLAUSE_VALIDATION } from '@ada/common';
import { DataProductIdentifier } from '../../data-product/api/types';
import { JsonSchema, JsonSchemaType } from 'aws-cdk-lib/aws-apigateway';

export const AttributePolicyIdentifier: JsonSchema = {
  id: `${__filename}/AttributePolicyIdentifier`,
  type: JsonSchemaType.OBJECT,
  properties: {
    namespaceAndAttributeId: {
      type: JsonSchemaType.STRING,
      ...NAMESPACED_ID_VALIDATION,
    },
    group: {
      type: JsonSchemaType.STRING,
      ...ID_VALIDATION,
    },
  },
  required: ['namespaceAndAttributeId', 'group'],
};

export const AttributePolicyIdentifierList: JsonSchema = {
  type: JsonSchemaType.OBJECT,
  properties: {
    policies: {
      type: JsonSchemaType.ARRAY,
      items: asRef(AttributePolicyIdentifier),
    },
  },
  required: ['policies'],
  definitions: {
    AttributePolicyIdentifier,
  },
};

export const AttributeValuePolicy: JsonSchema = extendSchema(
  {
    id: `${__filename}/AttributeValuePolicy`,
    type: JsonSchemaType.OBJECT,
    properties: {
      sqlClause: {
        description: 'An SQL WHERE clause for row level governance on the attribute',
        type: JsonSchemaType.STRING,
        ...SQL_CLAUSE_VALIDATION,
      },
      description: {
        type: JsonSchemaType.STRING,
        ...DESCRIPTION_VALIDATION,
      },
    },
    required: ['sqlClause'],
  },
  AttributePolicyIdentifier,
);

export const AttributePolicy: JsonSchema = extendSchema(
  {
    id: `${__filename}/AttributePolicy`,
    type: JsonSchemaType.OBJECT,
    properties: {
      lensId: LensProperty,
    },
    required: ['lensId'],
  },
  AttributePolicyIdentifier,
);

export const AttributePolicyList: JsonSchema = {
  type: JsonSchemaType.OBJECT,
  properties: {
    policies: {
      type: JsonSchemaType.ARRAY,
      items: asRef(AttributePolicy),
    },
  },
  required: ['policies'],
  definitions: {
    AttributePolicy,
  },
};

export const AttributeValuePolicyList: JsonSchema = {
  type: JsonSchemaType.OBJECT,
  properties: {
    policies: {
      type: JsonSchemaType.ARRAY,
      items: asRef(AttributeValuePolicy),
    },
  },
  required: ['policies'],
  definitions: {
    AttributeValuePolicy,
  },
};

export const DefaultLensPolicy: JsonSchema = extendSchema(
  {
    id: `${__filename}/DefaultLensPolicy`,
    type: JsonSchemaType.OBJECT,
    properties: {
      defaultLensId: LensProperty,
      defaultLensOverrides: {
        type: JsonSchemaType.OBJECT,
        additionalProperties: LensProperty,
      },
    },
    required: ['defaultLensId', 'defaultLensOverrides'],
  },
  DataProductIdentifier,
);

export const DataProductAccessLevel: JsonSchema = {
  id: `${__filename}/DataProductAccessLevel`,
  type: JsonSchemaType.OBJECT,
  properties: {
    access: asRef(AccessProperty),
  },
  required: ['access'],
  definitions: {
    AccessProperty,
  },
};

export const DataProductPermissions: JsonSchema = {
  id: `${__filename}/DataProductPermissions`,
  type: JsonSchemaType.OBJECT,
  additionalProperties: asRef(DataProductAccessLevel),
  definitions: {
    DataProductAccessLevel,
  },
};

export const DataProductPolicy: JsonSchema = extendSchema(
  {
    id: `${__filename}/DataProductPolicy`,
    type: JsonSchemaType.OBJECT,
    properties: {
      permissions: asRef(DataProductPermissions),
    },
    required: ['permissions'],
    definitions: {
      DataProductPermissions,
    },
  },
  DataProductIdentifier,
);
