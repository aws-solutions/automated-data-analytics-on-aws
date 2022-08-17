/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Alert } from 'aws-northstar';
import { Field } from '@data-driven-forms/react-form-renderer/common-types';
import { S3_OBJECT_PATH_REGEX, SourceTypeDefinitions } from '@ada/common';
import { componentTypes } from 'aws-northstar/components/FormRenderer/types';
import { sourceTypeSubForm } from '../common';
import { validatorTypes } from 'aws-northstar/components/FormRenderer';

const SOURCE_DEF = SourceTypeDefinitions.S3;

export const CREATE_FIELDS: Field[] = sourceTypeSubForm(SOURCE_DEF, [
  {
    component: componentTypes.TEXT_FIELD,
    name: 'sourceDetails.s3Path',
    label: 'S3 Location',
    description: 'Enter the folder location of the data in S3',
    placeholder: 's3://my-bucket/path/to/my/data',
    helperText: (
      <Alert type="info">
        Only folders are supported at this time; please ensure the path above is a folder and not file path. File
        support will be added in near future.
      </Alert>
    ),
    validate: [
      {
        type: validatorTypes.REQUIRED,
      },
      {
        type: validatorTypes.PATTERN,
        pattern: S3_OBJECT_PATH_REGEX,
        message: 'Must be a valid s3 url, eg s3://my-bucket/path/to/my/data',
      },
    ],
  },
]);
