/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CREATE_FIELDS } from './wizard';
import { ReactComponent as Icon } from './icon_kinesis.svg';
import { KINESIS_SOURCE_DEFINITION, SourceDetailsKinesis } from '@ada/common';
import { LL } from '$strings';
import { SourceSummary } from './SourceSummary';
import { UXDataProductSourceDefinition } from '../common';

export const KINESIS_SOURCE_UX: UXDataProductSourceDefinition<SourceDetailsKinesis> = {
  ...KINESIS_SOURCE_DEFINITION,
  CONTENT: {
    Icon,
    label: LL.ENTITY.DataProduct_.SourceType.KINESIS.label(),
    description: LL.ENTITY.DataProduct_.SourceType.KINESIS.description(),
  },
  SUMMARY: {
    SourceSummary,
  },
  WIZARD: {
    CREATE_FIELDS,
  },
};
