/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Field } from '@data-driven-forms/react-form-renderer/common-types';
import { SourceTypeDefinitions } from '@ada/common';
import { componentTypes } from 'aws-northstar/components/FormRenderer/types';
import { sourceTypeSubForm } from '../common';
import { validatorTypes } from 'aws-northstar/components/FormRenderer';

const SOURCE_DEF = SourceTypeDefinitions.KINESIS;

export const CREATE_FIELDS: Field[] = sourceTypeSubForm(SOURCE_DEF, [
  {
    component: componentTypes.TEXT_FIELD,
    name: 'sourceDetails.kinesisStreamArn',
    label: 'Kinesis Data Stream Arn',
    description: 'Enter the Arn of the Kinesis Data Stream',
    placeholder: 'arn:aws:kinesis:<region>:<account-number>:stream/<stream-name>',
    validate: [
      {
        type: validatorTypes.REQUIRED,
      },
      {
        type: validatorTypes.PATTERN,
        pattern: /arn:aws:kinesis:[A-Za-z-0-9]+:\d+:stream\/[A-Za-z-0-9]+/,
        message: 'Must be a valid arn, eg. arn:aws:kinesis:<region>:<account-number>:stream/<stream-name>',
      },
    ],
  },
]);
