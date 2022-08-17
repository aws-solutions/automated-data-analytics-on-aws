/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { JsonSchema, JsonSchemaType, JsonSchemaVersion } from '../../../../api';

// https://regexr.com/6nu8v
export const PRIVATE_KEY_PATTERN = /^(-{5}BEGIN PRIVATE KEY-{5}\s(([\w+/=]{63,76}\s){10,30})([\w+/=]{1,76}\s)?-{5}END PRIVATE KEY-{5})\s?$/m //NOSONAR - ignore duplicates in pattern

// https://cloud.google.com/resource-manager/docs/creating-managing-projects
// https://regexr.com/6o4si
export const GOOGLE_PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/ //NOSONAR - ignore duplicates in pattern

export const GOOGLE_SERVICE_ACCOUNT_EMAIL_PATTERN = /^[^@]+@[^@]+\.iam\.gserviceaccount\.com$/

/**
 * Common google source details for account auth
 */
export interface GoogleServiceAccountAuth {
  projectId: string;
  clientEmail: string;
  clientId: string;
  privateKeyId: string;
  // will only be used on the Put request
  privateKey?: string;
  // this will be stored in ddb
  privateKeySecretName?: string;
}

/**
 * Property keys extracted from Google Service Account json files.
 */
export const GOOGLE_SERVICE_ACCOUNT_JSON_KEYS: (keyof GoogleServiceAccountAuth)[]  = [
  'projectId',
  'clientId',
  'clientEmail',
  'privateKeyId',
  'privateKey',
]

/**
 * The input details for file upload
 */
export const GoogleServiceAccountAuth: JsonSchema = { //NOSONAR (S2814:Duplicate) - false positive - type vs value
  id: `${__filename}/GoogleServiceAccountAuth`,
  schema: JsonSchemaVersion.DRAFT4,
  type: JsonSchemaType.OBJECT,
  properties: {
    projectId: {
      type: JsonSchemaType.STRING,
      title: 'Project Id',
      description: 'The ID of the Google Cloud Project',
      pattern: GOOGLE_PROJECT_ID_PATTERN.source,
      minLength: 6,
      maxLength: 30
    },
    clientEmail: {
      type: JsonSchemaType.STRING,
      title: 'Client Email',
      description: 'The email address of the service account',
      pattern: GOOGLE_SERVICE_ACCOUNT_EMAIL_PATTERN.source
    },
    clientId: {
      type: JsonSchemaType.STRING,
      title: 'Client ID',
      description: 'The client id of the Google Service Account',
    },
    privateKeyId: {
      type: JsonSchemaType.STRING,
      title: 'Private Key ID',
      description: 'The private key id of the Google Service Account',
    },
    privateKey: {
      type: JsonSchemaType.STRING,
      title: 'Private Key',
      description: 'The private key of the service account',
      pattern: PRIVATE_KEY_PATTERN.source,
    },
    privateKeySecretName: {
      type: JsonSchemaType.STRING,
    },
  },
  required: ['projectId', 'clientEmail', 'clientId', 'privateKeyId'],
};
