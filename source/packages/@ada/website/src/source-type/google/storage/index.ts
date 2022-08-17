/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CREATE_FIELDS } from './wizard';
import { GOOGLE_STORAGE_SOURCE_DEFINITION, SourceDetailsGoogleStorage, SourceDetailsGoogleXXX } from '@ada/common';
import { ReactComponent as Icon } from '../../../vendor/google/cloud_storage.svg';
import { LL } from '$strings';
import { SourceSummary } from '../common/SourceSummary';
import { UXDataProductSourceDefinition } from '../../common';

export const GOOGLE_STORAGE_SOURCE_UX: UXDataProductSourceDefinition<
  SourceDetailsGoogleStorage,
  SourceDetailsGoogleXXX
> = {
  ...GOOGLE_STORAGE_SOURCE_DEFINITION,
  CONTENT: {
    Icon,
    label: LL.ENTITY.DataProduct_.SourceType.GOOGLE_STORAGE.label(),
    description: LL.ENTITY.DataProduct_.SourceType.GOOGLE_STORAGE.description(),
  },
  SUMMARY: {
    SourceSummary,
  },
  WIZARD: {
    CREATE_FIELDS,
  },
};
