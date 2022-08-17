/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CREATE_FIELDS } from './wizard';
import { GOOGLE_ANALYTICS_SOURCE_DEFINITION, SourceDetailsGoogleAnalytics, SourceDetailsGoogleXXX } from '@ada/common';
import { ReactComponent as Icon } from '../../../vendor/google/ga.svg';
import { LL } from '$strings';
import { SourceSummary } from '../common/SourceSummary';
import { UXDataProductSourceDefinition } from '../../common';

export const GOOGLE_ANALYTICS_SOURCE_UX: UXDataProductSourceDefinition<
  SourceDetailsGoogleAnalytics,
  SourceDetailsGoogleXXX
> = {
  ...GOOGLE_ANALYTICS_SOURCE_DEFINITION,
  CONTENT: {
    Icon,
    label: LL.ENTITY.DataProduct_.SourceType.GOOGLE_ANALYTICS.label(),
    description: LL.ENTITY.DataProduct_.SourceType.GOOGLE_ANALYTICS.description(),
  },
  SUMMARY: {
    SourceSummary,
  },
  WIZARD: {
    CREATE_FIELDS,
  },
};
