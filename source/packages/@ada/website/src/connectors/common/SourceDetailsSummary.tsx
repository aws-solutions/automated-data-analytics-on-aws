/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { Connectors } from '@ada/connectors';
import { SourceTypeSummaryComponent } from '.';
import { SummaryProperty, SummaryRenderer } from '$northstar-plus';

export const SourceDetailsSummary: SourceTypeSummaryComponent<any> = ({
  sourceType,
  sourceDetails,
  collapsible = true,
}) => {
  const properties = marshallSourceDetails(sourceType, sourceDetails);

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
 * Only render source details that the connector specifies.
 * @param sourceType
 * @param sourceDetails
 * @returns
 */
export function marshallSourceDetails(sourceType: Connectors.ID, sourceDetails: any): (SummaryProperty | null)[] {
  if (sourceDetails == null) return [];

  const properties = Connectors.find(sourceType).VIEW.Summary.properties;

  return properties.map(({ key, label, valueRenderer }) => {
    if (sourceDetails[key] != null) {
      let value = sourceDetails[key];
      if (valueRenderer) {
        value = valueRenderer(value);
      }
      return { label, value };
    }
    return null;
  })
}
