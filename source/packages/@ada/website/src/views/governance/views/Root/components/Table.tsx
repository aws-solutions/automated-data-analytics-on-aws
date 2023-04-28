/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AttributePolicy, OntologyIdentifier } from '@ada/api';
import { Button, Inline, Link, Select, Text } from 'aws-northstar';
import { Column } from 'aws-northstar/components/Table';
import { DefaultGroupIds } from '@ada/common';
import { FlexTable } from '$common/components';
import { GOVERNABLE_GROUPS, LENSE_OPTIONS_WITH_NULLABLE, NONE_LENS, NONE_LENS_OPTION } from '$common/entity/ontology';
import { Skeletons } from '$northstar-plus/components/skeletons';
import { apiHooks, useApiInvalidation } from '$api';
import { isEmpty, startCase, upperCase } from 'lodash';
import { useHistory } from 'react-router';
import { useI18nContext } from '$strings';
import { useImmer } from 'use-immer';
import { useNotificationContext } from '$northstar-plus';
import { useStatefulRef } from '$common/hooks';
import React, { useCallback, useMemo, useState } from 'react';
import type { LensEnum, Ontology } from '@ada/api';

const DEFAULT_ATTRIBUTE_POLICY_GROUP_MAP = {
  [DefaultGroupIds.DEFAULT]: {},
  [DefaultGroupIds.POWER_USER]: {},
  [DefaultGroupIds.ADMIN]: {},
};

type LENS_VALUES = LensEnum | typeof NONE_LENS;

export interface OntologiesTableProps {}

type DefaultGroupAttributePolicies = Record<GOVERNABLE_GROUPS, LensEnum>;
type OntologyWithAttributePolicies = Ontology & DefaultGroupAttributePolicies;

interface AttributePoliciesForGroup {
  [groupId: string]: { [namespaceAndAttributeId: string]: LENS_VALUES };
}

function ontologyId({ ontologyNamespace, ontologyId: _ontologyId }: OntologyIdentifier): string {
  return `${ontologyNamespace}.${_ontologyId}`;
}

// TODO: rename this after refactor contents
export const OntologiesTable: React.FC<OntologiesTableProps> = () => {
  const history = useHistory();
  const { LL } = useI18nContext();
  const { addError, addSuccess, addBrief } = useNotificationContext();

  const [isEditing, setIsEditing] = useState(false);

  // fetch all ontologies
  const [ontologies] = apiHooks.useAllOntologies();

  // DEFAULT USERS
  const [defaultUsersAttributePolicies] = apiHooks.useGovernancePolicyAttributes(
    {
      group: DefaultGroupIds.DEFAULT,
      namespaceAndAttributeIds: (ontologies || []).map(ontologyId),
    },
    { enabled: !isEmpty(ontologies) },
  );
  // POWER USERS
  const [powerUsersAttributePolicies] = apiHooks.useGovernancePolicyAttributes(
    {
      group: DefaultGroupIds.POWER_USER,
      namespaceAndAttributeIds: (ontologies || []).map(ontologyId),
    },
    { enabled: !isEmpty(ontologies) },
  );
  // ADMIN
  const [adminUsersAttributePolicies] = apiHooks.useGovernancePolicyAttributes(
    {
      group: DefaultGroupIds.ADMIN,
      namespaceAndAttributeIds: (ontologies || []).map(ontologyId),
    },
    { enabled: !isEmpty(ontologies) },
  );

  // Create map of group => attributes lens maps
  const attributePolicies = useMemo<AttributePoliciesForGroup>(() => {
    return {
      [DefaultGroupIds.DEFAULT]: defaultUsersAttributePolicies?.attributeIdToLensId || {},
      [DefaultGroupIds.POWER_USER]: powerUsersAttributePolicies?.attributeIdToLensId || {},
      [DefaultGroupIds.ADMIN]: adminUsersAttributePolicies?.attributeIdToLensId || {},
    };
  }, [defaultUsersAttributePolicies, powerUsersAttributePolicies, adminUsersAttributePolicies]);

  const [putAttributePolicies, putOperation] = apiHooks.usePutGovernancePolicyAttributesAsync();
  const [deleteAttributePolicies, deleteOperation] = apiHooks.useDeleteGovernancePolicyAttributesAsync();

  const allowEdit = putOperation.isAllowed && deleteOperation.isAllowed;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { invalidateOperation } = useApiInvalidation();
  const invalidate = useCallback(() => {
    invalidateOperation('GovernancePolicyAttributes');
  }, [invalidateOperation]);

  const [modifiedAttributePolicies, updateModifiedAttributePolicies] = useImmer<AttributePoliciesForGroup>(
    DEFAULT_ATTRIBUTE_POLICY_GROUP_MAP,
  );
  const modifiedAttributePoliciesRef = useStatefulRef(modifiedAttributePolicies);
  const modifyAttributePolicy = useCallback(
    (groupId: string, _ontologyId: string, lens: LENS_VALUES) => {
      updateModifiedAttributePolicies((draft) => {
        draft[groupId][_ontologyId] = lens;
      });
    },
    [updateModifiedAttributePolicies],
  );

  const getOntologyAttributePolicyGroupLens = useCallback(
    (groupId: string, _ontologyId: string) => {
      const modifiedValue = (modifiedAttributePoliciesRef.current![groupId] || {})[_ontologyId];
      if (modifiedValue) return modifiedValue;
      return (attributePolicies[groupId] || {})[_ontologyId];
    },
    [attributePolicies, modifiedAttributePoliciesRef],
  );

  const onCancel = useCallback(() => {
    setIsEditing(false);
    updateModifiedAttributePolicies(DEFAULT_ATTRIBUTE_POLICY_GROUP_MAP);
  }, [updateModifiedAttributePolicies]);

  /* eslint-disable sonarjs/cognitive-complexity */
  const onSave = useCallback(async () => { //NOSONAR (S3776:Cognitive Complexity) - won't fix
    try {
      setIsSubmitting(true);

      const policiesToUpdate = [] as AttributePolicy[];
      const policiesToDelete = [] as Omit<AttributePolicy, 'lensId'>[];
      Object.entries(modifiedAttributePolicies).forEach(([groupId, groupPolicies]) => {
        Object.entries(groupPolicies).forEach(([_ontologyId, lens]) => {
          // check modified vs original to ensure values are dirty
          const existingLens = (attributePolicies[groupId] || {})[_ontologyId];
          if (existingLens !== lens) {
            if (lens === NONE_LENS_OPTION.value) {
              if (existingLens != null) {
                policiesToDelete.push({
                  group: groupId,
                  namespaceAndAttributeId: _ontologyId,
                });
              }
            } else {
              policiesToUpdate.push({
                group: groupId,
                lensId: lens as LensEnum,
                namespaceAndAttributeId: _ontologyId,
              });
            }
          }
        });
      });

      if (isEmpty(policiesToUpdate) && isEmpty(policiesToDelete)) {
        // nothing was modified - ignore
        addBrief({
          header: LL.VIEW.notify.brief.ignoreSave.header(),
          content: LL.VIEW.notify.brief.ignoreSave.content(),
          type: 'info',
        });
      } else {
        // batch delete
        if (!isEmpty(policiesToDelete)) {
          await deleteAttributePolicies({
            deleteGovernancePolicyAttributesRequest: {
              policies: policiesToDelete,
            },
          });
        }
        // batch update
        if (!isEmpty(policiesToUpdate)) {
          await putAttributePolicies({
            putGovernancePolicyAttributesRequest: {
              policies: policiesToUpdate,
            },
          });
        }

        addSuccess({
          header: LL.ENTITY.Ontologies__CREATED_OR_UPDATED(),
          content: LL.VIEW.GOVERNANCE.notify.updatedAndDeleted({
            updated: policiesToUpdate.length,
            deleted: policiesToDelete.length,
          }),
        });
      }
    } catch (error: any) {
      console.error('Failed to save goverance policies', error);
      addError({
        header: LL.ENTITY.Ontologies__FAILED_TO_CREATE_OR_UPDATE(),
        content: error.message,
      });
    } finally {
      setIsEditing(false);
      setIsSubmitting(false);
      invalidate();
    }
  }, [
    putAttributePolicies,
    deleteAttributePolicies,
    modifiedAttributePolicies,
    attributePolicies,
    addBrief,
    addError,
    addSuccess,
  ]);

  const columnDefinitions = useMemo<Column<OntologyWithAttributePolicies>[]>(
    () => [ //NOSONAR (S3776:Cognitive Complexity) - won't fix
      {
        id: 'namespace',
        accessor: (data) => startCase(data.ontologyNamespace),
        Header: LL.ENTITY['Ontology@'].namespace.label(),
        width: 100,
      },
      {
        id: 'name',
        Header: LL.ENTITY['Ontology@'].name.label(),
        accessor: (data) => data.name || data.ontologyId,
        width: 200,
        Cell: ({ row }: { row: { original: OntologyWithAttributePolicies } }) => {
          const { ontologyNamespace, ontologyId: _ontologyId, name } = row.original;
          return <Link href={`/governance/${ontologyNamespace}.${_ontologyId}`}>{name || _ontologyId}</Link>;
        },
      },
      {
        id: 'description',
        accessor: 'description',
        Header: LL.ENTITY['Ontology@'].description.label(),
        width: 200,
      },
      ...Object.values(GOVERNABLE_GROUPS).map((groupId) => ({
        id: groupId,
        accessor: groupId,
        Header: startCase((groupId === DefaultGroupIds.DEFAULT ? `${groupId}-user` : groupId) + 's'),
        width: isEditing ? 100 : 10,
        Cell: ({ row }: { row: { original: OntologyWithAttributePolicies } }) => {
          const id = ontologyId(row.original);
          const value = getOntologyAttributePolicyGroupLens(groupId, id);

          if (isEditing) {
            return (
              <Select
                label={`${id}:${groupId}`}
                disabled={isSubmitting}
                selectedOption={value ? { value, label: upperCase(value) } : NONE_LENS_OPTION}
                options={LENSE_OPTIONS_WITH_NULLABLE}
                onChange={(event) => {
                  modifyAttributePolicy(groupId, ontologyId(row.original), event.target.value as LENS_VALUES);
                }}
              />
            );
          }

          if (value && value !== NONE_LENS_OPTION.value) {
            return upperCase(value);
          }

          if (row.original.defaultLens) {
            return `*${upperCase(row.original.defaultLens)}`;
          }

          return '-';
        },
      })),
    ],
    [isEditing, isSubmitting, getOntologyAttributePolicyGroupLens, modifyAttributePolicy],
  );

  /* eslint-enable sonarjs/cognitive-complexity */

  const actionGroup = useMemo(() => {
    if (allowEdit && isEditing) {
      return (
        <Inline>
          <Button onClick={onCancel} disabled={isSubmitting}>
            {LL.VIEW.action.cancel.text()}
          </Button>
          <Button variant="primary" onClick={onSave} loading={isSubmitting}>
            {LL.VIEW.action.save.text()}
          </Button>
        </Inline>
      );
    }

    return (
      <Inline>
        <Button
          disabled={!allowEdit || !ontologies?.length}
          onClick={allowEdit ? () => setIsEditing(true) : undefined}
        >
          {LL.VIEW.GOVERNANCE.actions.editGovernance()}
        </Button>
        <Button
          variant="primary"
          disabled={!allowEdit}
          onClick={allowEdit ? () => history.push('/governance/new') : undefined}
        >
          {LL.VIEW.GOVERNANCE.actions.addOntolgoy()}
        </Button>
      </Inline>
    );
  }, [allowEdit, isEditing, isSubmitting, ontologies, history, onSave]);

  if (ontologies == null) {
    return <Skeletons.Table rowHeight={80} />;
  }

  return (
    <>
      <FlexTable
        tableTitle={LL.VIEW.GOVERNANCE.tables.OntologyWithAttributePolicies.title()}
        tableDescription={LL.VIEW.GOVERNANCE.tables.OntologyWithAttributePolicies.description()}
        actionGroup={actionGroup}
        columnDefinitions={columnDefinitions}
        getRowId={({ ontologyNamespace, ontologyId: _ontologyId }: any) => `${ontologyNamespace}.${_ontologyId}`}
        items={ontologies as OntologyWithAttributePolicies[]}
        disableRowSelect
        preventVerticalScroll
      />
      <Text variant="small" color="textSecondary">
        {LL.VIEW.GOVERNANCE.tables.astriksPolicyDisclaimer()}
      </Text>
    </>
  );
};
