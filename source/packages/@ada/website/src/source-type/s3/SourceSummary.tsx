/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { SourceDetailsS3 } from '@ada/common';
import { SourceDetailsSummary } from '$source-type/common/SourceDetailsSummary';
import { SourceTypeSummaryComponent } from '../common';

export const SourceSummary: SourceTypeSummaryComponent<SourceDetailsS3> = SourceDetailsSummary;
