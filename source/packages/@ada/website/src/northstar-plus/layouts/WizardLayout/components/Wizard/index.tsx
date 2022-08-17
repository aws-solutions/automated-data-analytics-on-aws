/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { WizardActionCallback } from '../WizardInner';
import { WizardStep } from '../../types';
import { WizardStepInfo } from 'aws-northstar/components/Wizard';
import { useFormRendererContext } from 'aws-northstar/components/FormRenderer';
import React, { FunctionComponent, useCallback, useMemo, useState } from 'react';
import WizardStepComponent from '../WizardStep';

export interface WizardMappingProps {
  fields: WizardStep[];
  submitButtonText?: string;
}

export const WizardMapping: FunctionComponent<WizardMappingProps> = ({ fields, submitButtonText }) => {
  const [maxStepIndex, setMaxStepIndex] = useState(0);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const { isSubmitting } = useFormRendererContext();

  const stepsInfo: WizardStepInfo[] = useMemo(() => {
    return fields.map((field) => ({
      title: field.title,
      isOptional: field.isOptional,
    }));
  }, [fields]);

  const step = useMemo(() => {
    return fields[activeStepIndex];
  }, [fields, activeStepIndex]);

  const handleNextButtonClick = useCallback<WizardActionCallback>(
    (event, wizardState) => {
      let target = activeStepIndex + 1;
      if (step.onNextButtonClick) {
        const nextResult = step.onNextButtonClick(event, wizardState);
        // prevent default action when callback returns `false`
        if (nextResult === false) return;

        if (typeof nextResult === 'number') {
          target = nextResult;
        }
      }

      setActiveStepIndex(target);
      if (target > maxStepIndex) {
        setMaxStepIndex(target);
      }
    },
    [activeStepIndex, maxStepIndex, setMaxStepIndex, step.onNextButtonClick],
  );

  const handlePreviousButtonClick = useCallback<WizardActionCallback>(
    (event, wizardState) => {
      let target = activeStepIndex - 1;
      if (step.onPreviousButtonClick) {
        const prevResult = step.onPreviousButtonClick(event, wizardState);
        // prevent default action when callback returns `false`
        if (prevResult === false) return;

        if (typeof prevResult === 'number') {
          target = prevResult;
        }
      }

      setActiveStepIndex(Math.max(0, target));
    },
    [activeStepIndex, setActiveStepIndex, step.onPreviousButtonClick],
  );

  return (
    <WizardStepComponent
      activeStepIndex={activeStepIndex}
      maxStepIndex={maxStepIndex}
      stepsInfo={stepsInfo}
      {...step}
      submitButtonText={submitButtonText}
      onNextButtonClick={handleNextButtonClick}
      onPreviousButtonClick={handlePreviousButtonClick}
      isSubmitting={isSubmitting}
      setActiveStepIndex={setActiveStepIndex}
    />
  );
};

export default WizardMapping;
