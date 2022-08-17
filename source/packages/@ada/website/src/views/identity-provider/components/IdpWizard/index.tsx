/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { FormData, buildSteps, formDataToInput, getInitialValues } from './schema';
import { WizardLayout, WizardStep, useNotificationContext } from '$northstar-plus';
import { apiHooks } from '$api';
import { useHistory } from 'react-router-dom';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import React, { useCallback, useMemo } from 'react';

export interface IdpWizardProps {
  // If identityProviderId is defined the wizard is considered "edit mode"
  readonly identityProviderId?: string;
}

export const IdpWizard: React.FC<IdpWizardProps> = ({ identityProviderId }) => {
  const { LL } = useI18nContext();
  const history = useHistory();
  const { addError, addSuccess } = useNotificationContext();
  const [idp] = apiHooks.useIdentityProvider(
    { identityProviderId: identityProviderId! },
    { enabled: !!identityProviderId },
  );
  // TODO: `useIdentityAttributes` does not take requestParameters and breaks types
  const [cognitoAttributes] = (apiHooks.useIdentityAttributes as CallableFunction)();
  const isNew = identityProviderId == null;

  const [save, { isLoading: isSubmitting }] = apiHooks.usePutIdentityProvider({
    onSuccess: ({ identityProviderId }) => { //NOSONAR (S1117:ShadowVar) - ignore for readability
      addSuccess({
        header: isNew
          ? LL.ENTITY.IdentityProvider__CREATED(identityProviderId)
          : LL.ENTITY.IdentityProvider__UPDATED(identityProviderId),
      });
      history.push(`/admin/identity/provider/${identityProviderId}`);
    },
    onError: (error) => {
      addError({
        header: isNew
          ? LL.ENTITY.IdentityProvider__FAILED_TO_CREATE(identityProviderId)
          : LL.ENTITY.IdentityProvider__FAILED_TO_UPDATE(identityProviderId),
        content: error.message,
      });
    },
  });

  const steps = useMemo<WizardStep[]>(() => {
    return buildSteps(identityProviderId, cognitoAttributes?.attributes || []);
  }, [identityProviderId, cognitoAttributes]);

  const initialValues = useMemo(() => getInitialValues(idp), [idp]);

  const submitHandler = useCallback(
    (formData: FormData) => {
      const input = formDataToInput(formData);
      save({
        identityProviderId: input.identityProviderId,
        identityProviderInput: {
          ...input,
          enabled: true,
        },
      });
    },
    [save],
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
    >
    </WizardLayout>
  );
};
