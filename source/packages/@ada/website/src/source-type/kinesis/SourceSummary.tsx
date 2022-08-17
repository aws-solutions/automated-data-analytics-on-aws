/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { SourceDetailsKinesis } from '@ada/common';
import { SourceDetailsSummary } from '$source-type/common/SourceDetailsSummary';
import { SourceTypeSummaryComponent } from '../common';

export const SourceSummary: SourceTypeSummaryComponent<SourceDetailsKinesis> = SourceDetailsSummary;
