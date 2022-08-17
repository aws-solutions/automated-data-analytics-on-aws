/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AUTH_FIELDS } from '../common/wizard';
import { Alert } from 'aws-northstar';
import { Field } from '@data-driven-forms/react-form-renderer/common-types';
import { GOOGLE_STORAGE_PATH_REGEX, SourceTypeDefinitions } from '@ada/common';
import { componentTypes } from 'aws-northstar/components/FormRenderer/types';
import { sourceTypeSubForm } from '../../common';
import { validatorTypes } from 'aws-northstar/components/FormRenderer';

const SOURCE_DEF = SourceTypeDefinitions.GOOGLE_STORAGE;

export const CREATE_FIELDS: Field[] = sourceTypeSubForm(SOURCE_DEF, [
  {
    component: componentTypes.TEXT_FIELD,
    name: 'sourceDetails.googleStoragePath',
    label: 'Google Storage Location',
    description: 'Enter the folder path of the data in Google Storage',
    placeholder: 'gs://my-bucket/path/to/my/data (folder)',
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
        pattern: GOOGLE_STORAGE_PATH_REGEX,
        message: 'Must be a valid Google Storage url, eg gs://my-bucket/path/to/my/data',
      },
    ],
  },
  ...AUTH_FIELDS,
]);
