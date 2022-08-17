/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DATE_VALIDATION, USER_IDENTIFIER_VALIDATION } from '@ada/common';
import { JsonSchema, JsonSchemaType, JsonSchemaVersion } from 'aws-cdk-lib/aws-apigateway';
import { RequestParameters } from './federated-api/types';

export { Tag, Tags } from '@ada/common';

export * from './enums';

export const ApiError: JsonSchema = {
  id: `${__filename}/ApiError`,
  schema: JsonSchemaVersion.DRAFT4,
  title: 'GenericError',
  type: JsonSchemaType.OBJECT,
  properties: {
    message: { type: JsonSchemaType.STRING },
    details: { type: JsonSchemaType.STRING },
    cause: { type: JsonSchemaType.STRING },
    name: { type: JsonSchemaType.STRING },
    errorId: { type: JsonSchemaType.STRING },
  },
  required: ['message'],
};

/**
 * Common fields for create/update metadata
 */
export const CreateAndUpdateDetails: JsonSchema = {
  id: `${__filename}/CreateAndUpdateDetails`,
  type: JsonSchemaType.OBJECT,
  properties: {
    createdBy: {
      type: JsonSchemaType.STRING,
      ...USER_IDENTIFIER_VALIDATION,
    },
    createdTimestamp: {
      type: JsonSchemaType.STRING,
      ...DATE_VALIDATION,
    },
    updatedBy: {
      type: JsonSchemaType.STRING,
      ...USER_IDENTIFIER_VALIDATION,
    },
    updatedTimestamp: {
      type: JsonSchemaType.STRING,
      ...DATE_VALIDATION,
    },
  },
};

/**
 * Schema for a paginated response
 */
export const PaginatedResponse: JsonSchema = {
  id: `${__filename}/PaginatedResponse`,
  type: JsonSchemaType.OBJECT,
  properties: {
    nextToken: {
      type: JsonSchemaType.STRING,
    },
    totalItems: {
      type: JsonSchemaType.NUMBER,
    },
  },
};

/**
 * Common query parameter definitions for Rest API
 */
export class CommonQueryParameters {
  static get Pagination() {
    return {
      nextToken: {
        in: 'querystring',
        schema: { type: 'string' },
        required: false,
      },
      pageSize: {
        in: 'querystring',
        schema: { type: 'integer' },
        required: false,
      },
      limit: {
        in: 'querystring',
        schema: { type: 'integer' },
        required: false,
      },
    } as RequestParameters;
  }
}
