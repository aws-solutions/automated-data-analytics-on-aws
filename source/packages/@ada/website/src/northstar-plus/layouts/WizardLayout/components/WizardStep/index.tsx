/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Field } from '@data-driven-forms/react-form-renderer';
import { WizardActionCallback, WizardInner, WizardInnerProps } from '../WizardInner';
import { useLayoutContext } from '$northstar-plus/layouts/AppLayout';
import React, { FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react';
import useFormApi from '@data-driven-forms/react-form-renderer/use-form-api';

export interface WizardStepProps
  extends Omit<
    WizardInnerProps,
    | 'onCancelButtonClick'
    | 'onSubmitButtonClick'
    | 'onStepNavigationClick'
    | 'getStepNumberLabel'
    | 'step'
    | 'stepCount'
  > {
  title: string;
  description?: string;
  fields: Field[];
  isSubmitting?: boolean;
}

export const WizardStep: FunctionComponent<WizardStepProps> = ({
  activeStepIndex,
  maxStepIndex,
  title,
  description,
  fields,
  stepsInfo,
  onNextButtonClick,
  onPreviousButtonClick,
  submitButtonText,
  isSubmitting,
  nextButtonText,
  previousButtonText,
  setActiveStepIndex,
  actionsRenderer,
}) => {
  const { contentRef } = useLayoutContext();
  const [showError, setShowError] = useState(false);
  const formOptions = useFormApi();
  const content = useMemo(() => {
    const editabledFields = fields.map((item) => ({
      ...item,
      showError,
    }));

    return formOptions.renderForm(editabledFields);
  }, [fields, showError, formOptions]);

  useEffect(() => {
    setShowError(false); // When steps change
    // reset scoll to top of page when steps are changed
    if (contentRef?.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeStepIndex]);

  const handleNextButtonClick = useCallback<WizardActionCallback>(
    (event, wizardState) => {
      const state = wizardState.form.getState();
      setShowError(true);
      if (!(state.invalid || state.validating || state.submitting)) {
        onNextButtonClick(event, wizardState);
      }
    },
    [onNextButtonClick],
  );

  return (
    <WizardInner
      step={{
        title,
        description,
        content,
      }}
      activeStepIndex={activeStepIndex}
      maxStepIndex={maxStepIndex}
      stepsInfo={stepsInfo}
      stepCount={stepsInfo.length}
      submitButtonText={submitButtonText}
      nextButtonText={nextButtonText}
      previousButtonText={previousButtonText}
      onNextButtonClick={handleNextButtonClick}
      onPreviousButtonClick={onPreviousButtonClick}
      onCancelButtonClick={formOptions.onCancel}
      onSubmitButtonClick={(event) => {
        event.preventDefault();
        formOptions.handleSubmit();
      }}
      disableStepNavigation
      isLoadingNextStep={isSubmitting}
      actionsRenderer={actionsRenderer}
      setActiveStepIndex={setActiveStepIndex}
    />
  );
};

export default WizardStep;
