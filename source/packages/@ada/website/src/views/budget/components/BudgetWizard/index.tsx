/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { FormData, buildSteps } from './schema';
import { WizardLayout, WizardStep, useNotificationContext } from '$northstar-plus';
import { apiHooks } from '$api';
import { useHistory } from 'react-router-dom';
import { useI18nContext } from '$strings';
import { useUserProfile } from '$core/provider/UserProvider';
import React, { useCallback, useMemo } from 'react';

export interface BudgetWizardProps {
  initialValues?: FormData;
}

export const BudgetWizard: React.FC<BudgetWizardProps> = ({ initialValues }) => {
  const { LL } = useI18nContext();
  const history = useHistory();
  const { addError, addSuccess } = useNotificationContext();
  const { email } = useUserProfile();
  const isNew = useMemo(() => !initialValues, [initialValues]);

  const [postBudget, { isLoading: isSubmitting }] = apiHooks.usePostAdministrationBudgets({
    onSuccess: (output) => {
      addSuccess({
        header: isNew ? LL.ENTITY.Budget__CREATED(output.budgetName) : LL.ENTITY.Budget__UPDATED(output.budgetName),
      });
      history.push(`/admin/budget`);
    },
    onError: (error, _input) => {
      addError({
        header: isNew ? LL.ENTITY.Budget__FAILED_TO_CREATE() : LL.ENTITY.Budget__FAILED_TO_UPDATE(),
        content: error.message,
      });
    },
  });

  const steps = useMemo<WizardStep[]>(() => {
    return buildSteps(isNew, email);
  }, [isNew, email]);

  const handleSubmit = useCallback((formData: Record<string, any>) => {
    const data = formData as FormData;
    postBudget({
      budgetInput: {
        budgetLimit: Number(data.budgetLimit),
        softNotifications: data.softNotifications || [],
        subscriberList: data.subscriberList?.map((item: any) => {
          return item.value;
        }) || [],
      },
    });
  }, []);

  const handleCancel = useCallback(() => {
    history.goBack();
  }, [history]);

  return (
    <WizardLayout 
      steps={steps}
      initialValues={initialValues} 
      onSubmit={handleSubmit} 
      isSubmitting={isSubmitting} 
      onCancel={handleCancel} />
  );
};
