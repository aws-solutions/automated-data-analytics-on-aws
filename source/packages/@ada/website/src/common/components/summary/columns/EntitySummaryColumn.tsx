/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Column, KeyValuePair, Stack } from 'aws-northstar';
import { RelativeDate, SummaryProperty } from '$northstar-plus';
import React from 'react';
import type { CreateAndUpdateDetails } from '@ada/api';

export interface EntitySummaryColumnProps {
  readonly entity?: CreateAndUpdateDetails;
  readonly createdLabel?: string;
  readonly updatedLabel?: string;
}

export const EntityCreatedKV: React.FC<Omit<EntitySummaryColumnProps, 'updatedLabel'>> = ({
  entity = {},
  createdLabel = 'Created',
}) => {
  return (
    <KeyValuePair
      label={createdLabel}
      value={
        entity.createdTimestamp ? (
          <RelativeDate
            date={entity.createdTimestamp}
            tooltipHeader={createdLabel}
            tooltip={`By ${entity.createdBy} at ${entity.createdTimestamp}`}
          />
        ) : null
      }
    />
  );
};

export const EntityUpdatedKV: React.FC<Omit<EntitySummaryColumnProps, 'createdLabel'>> = ({
  entity = {},
  updatedLabel = 'Updated',
}) => {
  return (
    <KeyValuePair
      label={updatedLabel}
      value={
        entity.updatedTimestamp ? (
          <RelativeDate
            date={entity.updatedTimestamp}
            tooltipHeader={updatedLabel}
            tooltip={`By ${entity.updatedBy} at ${entity.updatedTimestamp}`}
          />
        ) : null
      }
    />
  );
};

export const EntitySummaryColumn: React.FC<EntitySummaryColumnProps> = ({
  entity = {},
  createdLabel,
  updatedLabel,
}) => {
  return (
    <Column>
      <Stack>
        <EntityCreatedKV entity={entity} createdLabel={createdLabel} />
        <EntityUpdatedKV entity={entity} updatedLabel={updatedLabel} />
      </Stack>
    </Column>
  );
};

export const entitySummarySectionProperty = (props: EntitySummaryColumnProps): SummaryProperty => {
  return {
    value: <EntitySummaryColumn {...props} />,
  };
};
