/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CREATE_FIELDS } from './wizard';
import { GOOGLE_BIGQUERY_SOURCE_DEFINITION, SourceDetailsGoogleBigQuery, SourceDetailsGoogleXXX } from '@ada/common';
import { ReactComponent as Icon } from '../../../vendor/google/bigquery.svg';
import { LL } from '$strings';
import { SourceSummary } from '../common/SourceSummary';
import { UXDataProductSourceDefinition } from '../../common';

export const GOOGLE_BIGQUERY_SOURCE_UX: UXDataProductSourceDefinition<
  SourceDetailsGoogleBigQuery,
  SourceDetailsGoogleXXX
> = {
  ...GOOGLE_BIGQUERY_SOURCE_DEFINITION,
  CONTENT: {
    Icon,
    label: LL.ENTITY.DataProduct_.SourceType.GOOGLE_BIGQUERY.label(),
    description: LL.ENTITY.DataProduct_.SourceType.GOOGLE_BIGQUERY.description(),
  },
  SUMMARY: {
    SourceSummary,
  },
  WIZARD: {
    CREATE_FIELDS,
  },
};
