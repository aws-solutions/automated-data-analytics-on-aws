/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { JsonSchema, JsonSchemaType } from 'aws-cdk-lib/aws-apigateway';
import { TearDownMode } from './handlers/types';

export const TearDownDetails: JsonSchema = {
  id: `${__filename}/TearDownDetails`,
  type: JsonSchemaType.OBJECT,
  properties: {
    coreStackId: {
      type: JsonSchemaType.STRING,
    },
    mode: {
      type: JsonSchemaType.STRING,
      description: 'Indicates the teardown mode being performed.',
      enum: Object.values(TearDownMode),
    },
    message: {
      type: JsonSchemaType.STRING,
    },
    retainedResources: {
      type: JsonSchemaType.ARRAY,
      description:
        'List of resource arns that will be retained after deletion has completed, unless mode is destroy data.',
      items: {
        type: JsonSchemaType.STRING,
      },
    },
  },
  required: ['coreStackId', 'mode', 'message', 'retainedResources'],
};
