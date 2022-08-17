/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Alert, KeyValuePair, Stack, StatusIndicator } from 'aws-northstar';
import { CustomComponentTypes } from '$common/components';
import { CustomValidatorTypes } from '$common/components/form-renderer/validators';
import { DefaultGroupIds } from '@ada/common';
import { LL, useI18nContext } from '$strings';
import { TagGroup, WizardStep } from '$northstar-plus';
import { apiHooks } from '$api';
import { componentTypes } from 'aws-northstar/components/FormRenderer/types';
import { isEmpty, startCase } from 'lodash';
import { sortApiAccessPolicyIds } from '$common/entity/api-access-policy';
import { validatorTypes } from 'aws-northstar/components/FormRenderer';
import React, { useCallback } from 'react';
import type { Group } from '@ada/api';
export type FormData = Group;

export const buildSteps = (groupId: string | undefined): WizardStep[] => {
  const isExisting = groupId != null;

  return [
    {
      title: !isExisting ? LL.ENTITY.Group__CREATE() : LL.ENTITY.Group__UPDATE(groupId),
      description: LL.VIEW.GROUP.wizard.description(),
      fields: [
        {
          component: CustomComponentTypes.ENTITY_NAME,
          name: 'groupId',
          label: LL.ENTITY['Group@'].groupId.label(),
          description: LL.ENTITY['Group@'].groupId.description(),
          placeholder: LL.ENTITY['Group@'].groupId.placeholder(),
          isReadOnly: isExisting,
          disabled: isExisting,
        },
        {
          component: componentTypes.TEXT_FIELD,
          name: 'description',
          label: LL.ENTITY['Group@'].description.label(),
          description: LL.ENTITY['Group@'].description.description(),
          placeholder: LL.ENTITY['Group@'].description.placeholder(),
          validate: [
            {
              type: validatorTypes.MAX_LENGTH,
              threshold: 200,
            },
          ],
        },
        {
          component: componentTypes.CHECKBOX,
          name: 'autoAssignUsers',
          label: LL.ENTITY['Group@'].autoAssignUsers.label(),
          description: LL.ENTITY['Group@'].autoAssignUsers.description(),
          condition: { when: 'groupId', is: DefaultGroupIds.DEFAULT },
        },
        {
          component: CustomComponentTypes.USER_SELECT,
          multiSelect: true,
          freeSolo: true,
          name: 'members',
          label: LL.ENTITY['Group@'].members.label(),
          description: LL.ENTITY['Group@'].members.description(),
          helperText: LL.ENTITY['Group@'].members.hintText(),
          emptyText: LL.ENTITY['Group@'].members.emptyText(),
          validate: [
            {
              type: CustomValidatorTypes.NO_DUPLICATES,
            },
          ],
        },
        {
          component: CustomComponentTypes.ACCESSPOLICY_SELECT,
          multiSelect: true,
          freeSolo: true,
          name: 'apiAccessPolicyIds',
          label: LL.ENTITY['Group@'].accessPolicies.label(),
          description: LL.ENTITY['Group@'].accessPolicies.description(),
          helperText: LL.ENTITY['Group@'].accessPolicies.hintText(),
          emptyText: LL.ENTITY['Group@'].accessPolicies.emptyText(),
          validate: [
            {
              type: CustomValidatorTypes.NO_DUPLICATES,
            },
          ],
          // Do NOT allow changing the Admin group policies
          condition: {
            when: 'groupId',
            is: DefaultGroupIds.ADMIN,
            then: { visible: false },
            else: { visible: true },
          },
        },
      ],
    },
    {
      title: LL.VIEW.wizard.STEP.review.title(),
      fields: [
        {
          component: componentTypes.REVIEW,
          name: 'review',
          Template: ({ data }: { data: FormData }) => {
            const [apiAccessPolicies] = apiHooks.useApiAccessPolicies();
            const getApiAccessPolicyName = useCallback(
              (id: string): string => {
                if (apiAccessPolicies == null) return startCase(id);
                return apiAccessPolicies.find((policy) => policy.apiAccessPolicyId === id)?.name || startCase(id);
              },
              [apiAccessPolicies],
            );

            return (
              <Stack spacing="l">
                <KeyValuePair label={LL.ENTITY['Group@'].groupId.label()} value={data.groupId} />
                <KeyValuePair label={LL.ENTITY['Group@'].description.label()} value={data.description || '-'} />

                {data.groupId === DefaultGroupIds.DEFAULT ? (
                  data.autoAssignUsers ? (
                    <>
                      <Stack>
                        <KeyValuePair
                          label={LL.ENTITY['Group@'].autoAssignUsers.label()}
                          value={<StatusIndicator statusType="positive">Yes</StatusIndicator>}
                        />
                        <Alert type="warning" header="Caution">
                          {LL.VIEW.GROUP.AUTO_ASSIGN_USERS.WARNING.enabled()}
                        </Alert>
                        <KeyValuePair
                          label={LL.ENTITY['Group@'].members.label()}
                          value={
                            <StatusIndicator statusType="warning">
                              {LL.VIEW.GROUP.AUTO_ASSIGN_USERS.WARNING.members()}
                            </StatusIndicator>
                          }
                        />
                      </Stack>
                    </>
                  ) : (
                    <>
                      <Stack>
                        <KeyValuePair
                          label={LL.ENTITY['Group@'].autoAssignUsers.label()}
                          value={<StatusIndicator statusType="negative">No</StatusIndicator>}
                        />
                        <Alert type="info" header="Caution">
                          {LL.VIEW.GROUP.AUTO_ASSIGN_USERS.WARNING.disabled()}
                        </Alert>
                        <KeyValuePair
                          label={LL.ENTITY['Group@'].members.label()}
                          value={<MembersPreview members={data.members} />}
                        />
                      </Stack>
                    </>
                  )
                ) : (
                  <KeyValuePair
                    label={`${LL.ENTITY['Group@'].members.label()} (${(data.members || []).length})`}
                    value={<MembersPreview members={data.members} />}
                  />
                )}

                <KeyValuePair
                  label={LL.ENTITY.ApiAccessPolicy_.AccessLevel.title()}
                  value={
                    <>
                      {sortApiAccessPolicyIds(data.apiAccessPolicyIds || []).map((id: string, i) => (
                        <li key={i}>{getApiAccessPolicyName(id)}</li>
                      ))}
                    </>
                  }
                />
              </Stack>
            );
          },
        },
      ],
    },
  ];
};

const MembersPreview: React.FC<{ members?: string[] }> = ({ members }) => {
  const { LL:_LL } = useI18nContext();

  if (members == null || isEmpty(members)) {
    return <StatusIndicator statusType="warning">{_LL.VIEW.GROUP.wizard.review.noMembers()}</StatusIndicator>;
  }

  return <TagGroup tags={members.map((member) => ({ key: member }))} />;
};

export const getInitialValues = (group: Group | undefined): Partial<FormData> => {
  return {
    ...group,
    autoAssignUsers: group?.autoAssignUsers === true,
    // members: membersToFieldArray(group?.members),
    members: group?.members || [],
    apiAccessPolicyIds: group?.apiAccessPolicyIds || [],
    claims: group?.claims || [],
  };
};
