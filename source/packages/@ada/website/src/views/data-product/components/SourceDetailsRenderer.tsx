/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { SourceDetails, SourceType } from '@ada/common';
import { SourceTypeSummaryProps, UXDataProductSources } from '$source-type';
import React, { useMemo } from 'react';

export const SourceDetailsRenderer = ({
  sourceType,
  sourceDetails,
  collapsible,
}: SourceTypeSummaryProps<SourceDetails> & { sourceType: SourceType }) => {
  return useMemo(() => {
    const SourceSummary = Object.values(UXDataProductSources).find((def) => def.TYPE === sourceType)?.SUMMARY
      .SourceSummary;

    if (SourceSummary == null) return null;

    return <SourceSummary sourceType={sourceType} sourceDetails={sourceDetails as any} collapsible={collapsible} />;
  }, [sourceType, sourceDetails]);
};
