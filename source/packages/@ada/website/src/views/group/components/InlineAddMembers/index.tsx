/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Button, FormField, Inline } from 'aws-northstar';
import { apiHooks } from '$api';
import { useFederatedUsers } from '$common/entity/user';
import { useI18nContext } from '$strings';
import { useNotificationContext } from '$northstar-plus';
import { useStatefulRef } from '$common/hooks';
import Autosuggest, { SelectOption } from 'aws-northstar/components/Autosuggest';
import React, { useCallback, useMemo, useState } from 'react';

export interface InlineAddMembersProps {
  readonly groupId: string;
  readonly onAdded?: () => void;
}

export const InlineAddMembers: React.FC<InlineAddMembersProps> = ({ groupId, onAdded }) => {
  const { LL } = useI18nContext();
  const { addError, addSuccess } = useNotificationContext();

  const [member, setMember] = useState<SelectOption | null>(null);
  const memberRef = useStatefulRef(member);

  const [putGroupMembers, { isLoading: isSubmitting }] = apiHooks.usePutIdentityGroupMembers({
    onError: (error) => {
      addError({
        header: LL.VIEW.GROUP.AddMember.notify.error({ group: groupId, member: memberRef.current?.value || '' }),
        content: error.message,
      });
    },
    onSuccess: ({ groupId: _groupId }) => {
      addSuccess({
        header: LL.VIEW.GROUP.AddMember.notify.success({ group: _groupId, member: memberRef.current?.value || '' }),
      });
      setMember(null);
      onAdded && onAdded();
    },
  });

  const allUsers = useFederatedUsers();
  const options = useMemo<SelectOption[]>(() => {
    return allUsers.map((user) => ({ value: user.id }));
  }, [allUsers]);

  const submitHandler = useCallback(() => {
    if (member == null || member.value == null) return;
    const members = [member.value];

    putGroupMembers({
      groupId,
      groupMembersInput: {
        members,
      },
    });
  }, [groupId, member, putGroupMembers]);

  return (
    <FormField
      controlId="add-members"
      secondaryControl={
        <Inline>
          <Button
            onClick={submitHandler}
            disabled={member == null || isSubmitting}
            loading={isSubmitting}
            variant="primary"
          >
            {LL.VIEW.GROUP.AddMember.buttonText()}
          </Button>
        </Inline>
      }
    >
      <Autosuggest
        options={options}
        filteringType="manual"
        onChange={setMember}
        placeholder={LL.VIEW.GROUP.AddMember.input.placeholder()}
        disabled={isSubmitting}
        value={member || undefined}
      />
    </FormField>
  );
};
