/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Connectors } from '@ada/connectors';
import {SourceDetailsSummary, SourceTypeSummaryProps } from '$connectors/common';
import React, { useMemo } from 'react';

export const SourceDetailsRenderer = ({
  sourceType,
  sourceDetails,
  collapsible,
}: SourceTypeSummaryProps<any> & { sourceType: Connectors.ID }) => {
  return useMemo(() => {
    return (
      <SourceDetailsSummary
        sourceType={sourceType}
        sourceDetails={sourceDetails as any}
        collapsible={collapsible}
      />
    );
  }, [sourceType, sourceDetails]);
};
