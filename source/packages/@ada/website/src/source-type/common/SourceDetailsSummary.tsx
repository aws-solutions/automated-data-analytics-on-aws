/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { SourceType, getSourceTypePropertyNames } from '@ada/common';
import { SourceTypeSummaryComponent } from '.';
import { SummaryRenderer } from '$northstar-plus';
import { difference, isEmpty } from 'lodash';

export const SourceDetailsSummary: SourceTypeSummaryComponent<any> = ({
  sourceType,
  sourceDetails,
  propertiesToHide,
  collapsible = true,
}) => {
  const properties = marshallSourceDetails(sourceType, sourceDetails, propertiesToHide);

  return (
    <SummaryRenderer
      sections={[
        {
          title: 'Source Details',
          collapsible: collapsible,
          initiallyCollapsed: collapsible,
          options: {
            renderLabel: (label) => label,
            columns: 3,
          },
          properties,
        },
      ]}
    />
  );
};

/**
 * API client adds properties from *all* source detail schema in request results, so we need to clean to only show
 * properties for the specific type.
 * @param sourceType
 * @param sourceDetails
 * @returns
 */
export function marshallSourceDetails(sourceType: SourceType, sourceDetails: any, hide?: string[]) {
  if (sourceDetails == null) return;

  const properties = difference(getSourceTypePropertyNames(sourceType), hide || []);

  return properties.reduce((accum, key) => {
    const value = sourceDetails[key];
    if (isEmpty(value)) return accum;
    accum[key] = value;
    return accum;
  }, {} as any);
}
