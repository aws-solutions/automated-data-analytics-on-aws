/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as immer from 'immer';
import { AccessEnum, DataProductPolicyEntity } from '@ada/api';
import { BaseTable } from '$common/components/tables';
import { Button, Container, Inline, componentTypes, validatorTypes } from 'aws-northstar';
import { Column } from 'aws-northstar/components/Table';
import { CustomValidatorTypes } from '$common/components/form-renderer/validators';
import { DataProductAccess, DefaultGroupIds } from '@ada/common';
import { FormRenderer } from '$common/components';
import { ORDERED_SYSTEM_GROUPS } from '$common/entity/group';
import { Option } from 'aws-northstar/components/FormRenderer';
import { apiHooks } from '$api';
import { compact, sortBy } from 'lodash';
import { groupDisplayName } from '$common/entity/group/utils';
import { useDataProductContext } from '../context/DataProductContext';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useImmer } from 'use-immer';
import { useNotificationContext } from '$northstar-plus';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

interface PolicyTableItem {
  groupId: string;
  access: AccessEnum;
  disabled?: boolean;
}


export const Permisssions: React.FC = () => {
  const { LL } = useI18nContext();
  const { addError, addSuccess } = useNotificationContext();
  const { identifier, isUserAllowedToEdit } = useDataProductContext();
  const [isEditing, setIsEditing] = useState(false);

  const [groups] = apiHooks.useAllIdentityGroups();
  const [policyEntity] = apiHooks.useGovernancePolicyDomainDataProduct(identifier);
  const [policy, updatePolicy] = useImmer<DataProductPolicyEntity | undefined>(policyEntity);
  const [savePolicy, { isLoading: isSaving }] = apiHooks.usePutGovernancePolicyDomainDataProduct({
    onError: (error) => {
      addError({
        header: LL.VIEW.DATA_PRODUCT.PERMISSIONS.notify.FAILED_TO_UPDATE(),
        content: error.message,
      });
    },
    onSuccess: () => {
      addSuccess({
        header: LL.VIEW.DATA_PRODUCT.PERMISSIONS.notify.UPDATED(),
      });
    },
    onSettled: () => {
      setIsEditing(false);
    },
  });

  const groupOptions = useMemo<Option[]>(() => {
    return (groups || [])
      .filter(({ groupId }) => groupId !== DefaultGroupIds.ADMIN)
      .map((group): any => ({
        value: group.groupId,
        label: groupDisplayName(group.groupId),
      }));
  }, [groups]);

  useEffect(() => {
    updatePolicy(policyEntity);
  }, [policyEntity, updatePolicy]);

  const policyTableItems: PolicyTableItem[] = useMemo(() => {
    if (policy == null) return [];

    // first add system groups in order to keep on top
    const systemPolicies: PolicyTableItem[] = compact(
      ORDERED_SYSTEM_GROUPS.map((groupId) => {
        if (groupId in policy.permissions) {
          return {
            groupId,
            access: policy.permissions[groupId].access,
            // prevent modifying admin access
            disabled: groupId === DefaultGroupIds.ADMIN,
          };
        }
        return null;
      }),
    );

    // add all non-system groups in alphabetic order
    const nonSystemPolicies: PolicyTableItem[] = sortBy(
      compact(
        Object.entries(policy.permissions).map(([groupId, { access }]) => {
          if (ORDERED_SYSTEM_GROUPS.includes(groupId as any)) return null;

          return { groupId, access };
        }),
      ),
      'groupId',
    );

    return [...systemPolicies, ...nonSystemPolicies];
  }, [policy]);

  const onSave = useCallback(
    (formData: any) => {
      updatePolicy((draft) => {
        if (draft == null) throw new Error('Attempting to save policy update before policy has been fetched');
        draft.permissions = Object.fromEntries(
          formData.permissions.map((permission: PolicyTableItem) => [
            permission.groupId,
            { access: permission.access },
          ]),
        );

        const { permissions, updatedTimestamp } = immer.current(draft);

        // ensure admin always has full access
        permissions[DefaultGroupIds.ADMIN] = { access: DataProductAccess.FULL };

        savePolicy({
          ...identifier,
          dataProductPolicyInput: {
            updatedTimestamp,
            permissions,
          },
        });
      });

      setIsEditing(false);
    },
    [identifier, savePolicy, updatePolicy], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onCancel = useCallback(() => {
    updatePolicy(policyEntity);
    setIsEditing(false);
  }, [policyEntity, updatePolicy]);

  return isEditing ? (
    <Container title={LL.VIEW.DATA_PRODUCT.PERMISSIONS.title()} subtitle={LL.VIEW.DATA_PRODUCT.PERMISSIONS.subtitle()}>
      <FormRenderer
        schema={{
          fields: [
            {
              component: componentTypes.FIELD_ARRAY,
              name: 'permissions',
              label: LL.VIEW.DATA_PRODUCT.PERMISSIONS.FORM.title(),
              fields: [
                {
                  component: componentTypes.SELECT,
                  name: 'groupId',
                  options: groupOptions,
                  validate: [
                    {
                      type: validatorTypes.REQUIRED,
                    },
                  ],
                },
                {
                  component: componentTypes.SELECT,
                  name: 'access',
                  options: Object.values(DataProductAccess).map((value) => ({ value, label: value })),
                  validate: [
                    {
                      type: validatorTypes.REQUIRED,
                    },
                  ],
                },
              ],
              validate: [
                {
                  type: CustomValidatorTypes.NO_DUPLICATES,
                  by: 'groupId',
                },
              ],
            },
          ],
        }}
        onSubmit={onSave}
        onCancel={onCancel}
        isSubmitting={isSaving}
        initialValues={{ permissions: policyTableItems.filter((item) => item.groupId !== DefaultGroupIds.ADMIN) }}
      />
    </Container>
  ) : (
    <BaseTable
      tableTitle={LL.VIEW.DATA_PRODUCT.PERMISSIONS.title()}
      tableDescription={LL.VIEW.DATA_PRODUCT.PERMISSIONS.subtitle()}
      columnDefinitions={
        [
          {
            id: 'group',
            accessor: 'groupId',
            Header: LL.ENTITY.Group(),
            Cell: ({ value }) => groupDisplayName(value),
          },
          {
            id: 'access',
            accessor: 'access',
            Header: LL.ENTITY.DataProduct_.AccessLevel.label(),
          },
        ] as Column<PolicyTableItem>[]
      }
      items={policyTableItems}
      actionGroup={
        isUserAllowedToEdit ? (
          <Inline>
            <Button
              variant="normal"
              onClick={() => setIsEditing(true)}
              label={LL.VIEW.DATA_PRODUCT.PERMISSIONS.editButton.label()}
            >
              {LL.VIEW.DATA_PRODUCT.PERMISSIONS.editButton.text()}
            </Button>
          </Inline>
        ) : null
      }
    />
  );
};
