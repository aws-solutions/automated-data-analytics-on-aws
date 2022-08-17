/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CREATE_FIELDS } from './wizard';
import { ReactComponent as Icon } from './icon_s3.svg';
import { LL } from '$strings';
import { S3_SOURCE_DEFINITION, SourceDetailsS3 } from '@ada/common';
import { SourceSummary } from './SourceSummary';
import { UXDataProductSourceDefinition } from '../common';

export const S3_SOURCE_UX: UXDataProductSourceDefinition<SourceDetailsS3> = {
  ...S3_SOURCE_DEFINITION,
  CONTENT: {
    Icon,
    label: LL.ENTITY.DataProduct_.SourceType.S3.label(),
    description: LL.ENTITY.DataProduct_.SourceType.S3.description(),
  },
  SUMMARY: {
    SourceSummary,
  },
  WIZARD: {
    CREATE_FIELDS,
  },
};
