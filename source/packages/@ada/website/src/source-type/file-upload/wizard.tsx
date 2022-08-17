/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CustomComponentTypes } from '$common/components/form-renderer';
import { FILEUPLOAD_SUPPORTED_EXTENSIONS, SourceTypeDefinitions } from '@ada/common';
import { Field } from '@data-driven-forms/react-form-renderer/common-types';
import { sourceTypeSubForm } from '../common';
import { validatorTypes } from 'aws-northstar';

const SOURCE_DEF = SourceTypeDefinitions.UPLOAD;

export const UPLOAD_FILE_WIZARD_FIELDS = {
  UPLOAD_FILE: 'wizard.upload.file',
};

export const CREATE_FIELDS: Field[] = sourceTypeSubForm(SOURCE_DEF, [
  {
    component: CustomComponentTypes.FILE_UPLOAD,
    name: 'wizard.upload.file',
    label: 'Source File',
    description: 'Upload the file that contains the data you would like to query',
    accept: FILEUPLOAD_SUPPORTED_EXTENSIONS,
    isRequired: true,
    validate: [
      {
        type: validatorTypes.REQUIRED,
      },
    ],
  },
]);
