/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { SourceDetailsFileUpload } from '@ada/common';
import { SourceDetailsSummary } from '$source-type/common/SourceDetailsSummary';
import { SourceTypeSummaryComponent } from '../common';

const propertiesToHide = ['file'];

export const SourceSummary: SourceTypeSummaryComponent<SourceDetailsFileUpload> = (props) => {
  return <SourceDetailsSummary {...props} propertiesToHide={propertiesToHide} />;
};
