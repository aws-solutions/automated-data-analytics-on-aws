/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { FormData, buildSteps, getInitialValues } from './schema';
import { WizardLayout, WizardStep, useNotificationContext } from '$northstar-plus';
import { apiHooks } from '$api';
import { nameToIdentifier } from '$common/utils';
import { useHistory } from 'react-router-dom';
import { useI18nContext } from '$strings';
import React, { useCallback, useMemo } from 'react';

export interface GroupWizardProps {
  // If groupId is defined the wizard is considered "edit mode"
  readonly groupId?: string;
}

export const GroupWizard: React.FC<GroupWizardProps> = ({ groupId }) => {
  const { LL } = useI18nContext();
  const history = useHistory();
  const { addError, addSuccess } = useNotificationContext();
  const [group] = apiHooks.useIdentityGroup({ groupId: groupId! }, { enabled: !!groupId });
  const isNew = groupId == null;

  const [saveGroup, { isLoading: isSubmitting }] = apiHooks.usePutIdentityGroup({
    onSuccess: ({ groupId: _groupId }) => {
      addSuccess({
        header: isNew ? LL.ENTITY.Group__CREATED(_groupId) : LL.ENTITY.Group__UPDATED(_groupId),
      });
      history.push(`/groups/${_groupId}`);
    },
    onError: (error, _input) => {
      addError({
        header: isNew ? LL.ENTITY.Group__FAILED_TO_CREATE(groupId) : LL.ENTITY.Group__FAILED_TO_UPDATE(groupId),
        content: error.message,
      });
    },
  });

  const steps = useMemo<WizardStep[]>(() => {
    return buildSteps(groupId);
  }, [groupId]);

  const initialValues = useMemo(() => getInitialValues(group), [group]);

  const submitHandler = useCallback(
    ({ groupId: _groupId, members, ...groupInput }: FormData) => {
      _groupId = nameToIdentifier(_groupId);
      saveGroup({
        groupId: _groupId,
        groupInput: {
          groupId: _groupId,
          members,
          ...groupInput,
        },
      });
    },
    [saveGroup],
  );

  const cancelHandler = useCallback(() => {
    history.goBack();
  }, [history]);

  return (
    <WizardLayout
      steps={steps}
      initialValues={initialValues}
      onSubmit={submitHandler as any}
      isSubmitting={isSubmitting}
      onCancel={cancelHandler}
    />
  );
};
