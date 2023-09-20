/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AttributePolicy, AttributeValuePolicy, LensEnum, OntologyIdentifier } from '@ada/api';
import { DefaultGroupIds } from '@ada/common';
import { GOVERNABLE_GROUPS } from '$common/entity/ontology';
import { apiHooks } from '$api';
import { isEmpty } from '@aws-amplify/core';
import { useMemo } from 'react';

export interface OntologyGovernanceGroup {
  groupId: string;
  column?: LensEnum;
  row?: string; // sql clause
  columnUpdatedTimestamp?: string;
  rowUpdatedTimestamp?: string;
}

export const useOntologyGroupGovernance = (
  id: OntologyIdentifier,
  groupId: GOVERNABLE_GROUPS,
): [OntologyGovernanceGroup, { isLoading: boolean }] => {
  const [column, { isLoading: isLoadingColumn }] = apiHooks.useGovernancePolicyAttributesGroup({
    group: groupId,
    attributeId: id.ontologyId,
    ontologyNamespace: id.ontologyNamespace,
  });

  const [row, { isLoading: isLoadingRow }] = apiHooks.useGovernancePolicyAttributeValuesGroup({
    group: groupId,
    attributeId: id.ontologyId,
    ontologyNamespace: id.ontologyNamespace,
  });

  return useMemo(() => {
    const gov: OntologyGovernanceGroup = {
      groupId,
      column: column?.lensId,
      row: row?.sqlClause,
      columnUpdatedTimestamp: column?.updatedTimestamp,
      rowUpdatedTimestamp: row?.updatedTimestamp,
    };
    const isLoading = (column == null && isLoadingColumn) || (row == null && isLoadingRow);
    return [gov, { isLoading }];
  }, [groupId, column, isLoadingColumn, row, isLoadingRow]);
};

export const DEFAULT_RECORDS = {
  [DefaultGroupIds.DEFAULT]: {
    groupId: DefaultGroupIds.DEFAULT as string,
  },
  [DefaultGroupIds.POWER_USER]: {
    groupId: DefaultGroupIds.POWER_USER as string,
  },
  [DefaultGroupIds.ADMIN]: {
    groupId: DefaultGroupIds.ADMIN as string,
  },
};

export const useOntologyGovernanceAttribute = (
  id: OntologyIdentifier,
): [Record<string, OntologyGovernanceGroup> | undefined, { isLoading: boolean }] => {
  const [column, { isLoading: isLoadingColumn }] = apiHooks.useGovernancePolicyAttributesAttribute({
    attributeId: id.ontologyId,
    ontologyNamespace: id.ontologyNamespace,
  });

  const [row, { isLoading: isLoadingRow }] = apiHooks.useGovernancePolicyAttributeValuesAttribute({
    attributeId: id.ontologyId,
    ontologyNamespace: id.ontologyNamespace,
  });

  const isLoading = (isLoadingColumn || isLoadingRow);

  return useMemo(() => {
    if (isLoading) {
      return [undefined, { isLoading }];
    }

    const columnAggregatedRecords: Record<string, OntologyGovernanceGroup> = 
      column?.policies.reduce((agg: Record<string, OntologyGovernanceGroup>, c: AttributePolicy) => {
          return {
            ...agg,
            [c.group]: {
              ...agg[c.group],
              groupId: c.group,
              column: c.lensId,
            },
          }
    }, {}) || {};

    const records = row?.policies.reduce((agg: Record<string, OntologyGovernanceGroup>, r: AttributeValuePolicy) => {
      return {
        ...agg,
        [r.group]: {
          ...agg[r.group],
          groupId: r.group,
          row: r.sqlClause,
        },
      }
    }, columnAggregatedRecords) || {};

    return [
      records,
      { isLoading },
    ];
  }, [column, isLoading, row]);
};

export const useOntologyGovernance = (
  id: OntologyIdentifier,
): [Record<GOVERNABLE_GROUPS, OntologyGovernanceGroup> | undefined, { isLoading: boolean }] => {
  const [defaultGroupGov, { isLoading: isLoadingDefaultGov }] = useOntologyGroupGovernance(id, DefaultGroupIds.DEFAULT);
  const [powerGroupGov, { isLoading: isLoadingPowerGov }] = useOntologyGroupGovernance(id, DefaultGroupIds.POWER_USER);
  const [adminGroupGov, { isLoading: isLoadingAdminGov }] = useOntologyGroupGovernance(id, DefaultGroupIds.ADMIN);

  const isLoading =
    (defaultGroupGov == null && isLoadingDefaultGov) ||
    (powerGroupGov == null && isLoadingPowerGov) ||
    (adminGroupGov == null && isLoadingAdminGov);

  return useMemo(() => {
    if (isLoading) return [undefined, { isLoading }];

    return [
      {
        [DefaultGroupIds.DEFAULT]: defaultGroupGov,
        [DefaultGroupIds.POWER_USER]: powerGroupGov,
        [DefaultGroupIds.ADMIN]: adminGroupGov,
      },
      { isLoading },
    ];
  }, [defaultGroupGov, powerGroupGov, adminGroupGov, isLoading]);
};

export interface OntologyRowGovernance {
  groupId: string;
  sqlClause: string;
}

export const useOntologyRowGovernance = (
  id: OntologyIdentifier,
): [OntologyRowGovernance[] | undefined, { isLoading: boolean }] => {
  const [defaultGroupGov, { isLoading: isLoadingDefaultGov }] = useOntologyGroupGovernance(id, DefaultGroupIds.DEFAULT);
  const [powerGroupGov, { isLoading: isLoadingPowerGov }] = useOntologyGroupGovernance(id, DefaultGroupIds.POWER_USER);
  const [adminGroupGov, { isLoading: isLoadingAdminGov }] = useOntologyGroupGovernance(id, DefaultGroupIds.ADMIN);

  const isLoading = isLoadingDefaultGov || isLoadingPowerGov || isLoadingAdminGov;

  return useMemo(() => {
    if (isLoading) return [undefined, { isLoading }];

    const results: { groupId: string; sqlClause: string }[] = [];

    if (defaultGroupGov.row && !isEmpty(defaultGroupGov.row)) {
      results.push({
        groupId: DefaultGroupIds.DEFAULT,
        sqlClause: defaultGroupGov.row,
      });
    }

    if (powerGroupGov.row && !isEmpty(powerGroupGov.row)) {
      results.push({
        groupId: DefaultGroupIds.POWER_USER,
        sqlClause: powerGroupGov.row,
      });
    }

    if (adminGroupGov.row && !isEmpty(adminGroupGov.row)) {
      results.push({
        groupId: DefaultGroupIds.ADMIN,
        sqlClause: adminGroupGov.row,
      });
    }

    return [results, { isLoading }];
  }, [defaultGroupGov, powerGroupGov, adminGroupGov, isLoading]);
};
