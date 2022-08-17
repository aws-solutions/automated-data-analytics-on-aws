/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CREATE_FIELDS } from './wizard';
import { LL } from '$strings';
import { SourceDetailsFileUpload, UPLOAD_SOURCE_DEFINITION } from '@ada/common';
import { SourceSummary } from './SourceSummary';
import { UXDataProductSourceDefinition } from '../common';
import Icon from '@material-ui/icons/CloudUpload';

export const UPLOAD_SOURCE_UX: UXDataProductSourceDefinition<SourceDetailsFileUpload> = {
  ...UPLOAD_SOURCE_DEFINITION,
  CONTENT: {
    Icon,
    label: LL.ENTITY.DataProduct_.SourceType.UPLOAD.label(),
    description: LL.ENTITY.DataProduct_.SourceType.UPLOAD.description(),
  },
  SUMMARY: {
    SourceSummary,
  },
  WIZARD: {
    CREATE_FIELDS,
  },
};
