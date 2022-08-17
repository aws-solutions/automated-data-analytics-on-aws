/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { StepClickDetail, WizardStep, WizardStepInfo } from 'aws-northstar/components/Wizard/types';
import { compact, isNil, omitBy } from 'lodash';
import { getDataEqualityHash } from '$common/utils/misc';
import Box from 'aws-northstar/layouts/Box';
import Button from 'aws-northstar/components/Button';
import Container from 'aws-northstar/layouts/Container';
import FormSpy from '@data-driven-forms/react-form-renderer/form-spy';
import Inline from 'aws-northstar/layouts/Inline';
import React, { FunctionComponent, useCallback, useMemo, useState } from 'react';
import Stack from 'aws-northstar/layouts/Stack';
import Step from 'aws-northstar/components/Wizard/components/Step';
import StepNavigation from 'aws-northstar/components/Wizard/components/StepNavigation';
import useFormApi from '@data-driven-forms/react-form-renderer/use-form-api';

interface BaseWizardInnerProps {
  step: WizardStep;
  stepsInfo: WizardStepInfo[];
  stepCount: number;
  activeStepIndex: number;
  maxStepIndex: number;
  getStepNumberLabel?: (stepNumber: number) => string;
  cancelButtonText?: string;
  previousButtonText?: string;
  nextButtonText?: string;
  submitButtonText?: string;
  isLoadingNextStep?: boolean;
  setActiveStepIndex: React.Dispatch<React.SetStateAction<number>>;
}

export interface WizardState {
  props: BaseWizardInnerProps;
  form: ReturnType<typeof useFormApi>;
}

/**
 * Callback for wizard form control actions (cancel, previous, next, submit) which
 * recieves the current state of the wizard to customize the flow based on actions.
 *
 * @returns {false} will prevent default actions
 * @returns {number} will change wizard step to that number
 * @returns Any other than {false} or {number} value will perform default action
 */
export interface WizardActionCallback {
  (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, wizard: WizardState): boolean | number | void | undefined;
}

export interface WizardInnerProps extends BaseWizardInnerProps {
  onCancelButtonClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onPreviousButtonClick: WizardActionCallback;
  onNextButtonClick: WizardActionCallback;
  onSubmitButtonClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onStepNavigationClick?: (stepClickDetail: StepClickDetail) => void;
  optionalText?: string;
  /** Indicates whether the step navigation is disabled. When it is enabled, validation will need to take it into consideration. */
  disableStepNavigation?: boolean;
  /**
   * Overwrite the actions (form controls) that are rendered.
   * @param  {React.ReactNode[]} actions List of default actions to render
   * @returns {React.ReactNode[]} Return the actions to render as array.
   */
  actionsRenderer?: (wizardState: WizardState, actions: React.ReactNode[]) => React.ReactNode[];
}

export const WizardInner: FunctionComponent<WizardInnerProps> = ({
  optionalText = 'optional',
  disableStepNavigation = false,
  onCancelButtonClick,
  onPreviousButtonClick,
  onNextButtonClick,
  onSubmitButtonClick,
  onStepNavigationClick,
  actionsRenderer,
  getStepNumberLabel,
  setActiveStepIndex,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  children, //NOSONAR (S1172:Unused Function Parameter) - false positive
  ...props
}) => {
  const baseProps = useMemo<Required<BaseWizardInnerProps>>(() => {
    return {
      cancelButtonText: 'Cancel',
      previousButtonText: 'Previous',
      nextButtonText: 'Next',
      submitButtonText: 'Submit',
      isLoadingNextStep: false,
      setActiveStepIndex,
      getStepNumberLabel: getStepNumberLabel || ((stepNumber: number) => `Step ${stepNumber}`),
      ...(omitBy(props, isNil) as any),
    };
  }, [props, getStepNumberLabel, setActiveStepIndex]);
  const formApi = useFormApi();

  // track form values state to update actions
  const [valuesHash, setValuesHash] = useState<string>(() => getDataEqualityHash(formApi.getState().values));
  const onValuesChanged = useCallback((values: Record<string, any>) => {
    setValuesHash((current) => {
      const newValuesHash = getDataEqualityHash(values);
      if (current === newValuesHash) {
        return current;
      }
      return newValuesHash;
    });
  }, []);

  const actions = useMemo(() => {
    const {
      stepCount,
      activeStepIndex,
      cancelButtonText,
      previousButtonText,
      nextButtonText,
      submitButtonText,
      isLoadingNextStep,
    } = baseProps;

    const wizardState: WizardState = {
      props: baseProps,
      form: formApi,
    };

    const _actions: React.ReactNode[] = compact([
      <Button key="cancel" variant="link" onClick={onCancelButtonClick} disabled={isLoadingNextStep}>
        {cancelButtonText}
      </Button>,
      activeStepIndex !== 0 ? (
        <Button
          key="previous"
          variant="normal"
          onClick={(event) => onPreviousButtonClick(event, wizardState)}
          disabled={isLoadingNextStep}
        >
          {previousButtonText}
        </Button>
      ) : undefined,
      <Button
        key="next"
        variant="primary"
        loading={isLoadingNextStep}
        onClick={
          activeStepIndex === stepCount - 1 ? onSubmitButtonClick : (event) => onNextButtonClick(event, wizardState)
        }
      >
        {activeStepIndex === stepCount - 1 ? submitButtonText : nextButtonText}
      </Button>,
    ]);

    if (actionsRenderer) {
      return compact(actionsRenderer(wizardState, _actions));
    }

    return _actions;
  }, [
    baseProps,
    valuesHash,
    actionsRenderer,
    onCancelButtonClick,
    onNextButtonClick,
    onPreviousButtonClick,
    onSubmitButtonClick,
  ]);

  return (
    <Container>
      {/* Spy on form values changes to ensure actions are updated */}
      <FormSpy subscription={{ values: true }} onChange={(_props) => onValuesChanged(_props.values)} />

      <Box display="flex">
        <Box>
          <Box mr={8}>
            <StepNavigation
              disableStepNavigation={disableStepNavigation}
              steps={baseProps.stepsInfo}
              getStepNumberLabel={baseProps.getStepNumberLabel}
              activeStepIndex={baseProps.activeStepIndex}
              maxStepIndex={baseProps.maxStepIndex}
              optionalText={optionalText}
              onStepNavigationClick={onStepNavigationClick}
            />
          </Box>
        </Box>
        <Box flexGrow={1}>
          <Stack>
            <Box>
              <Step step={baseProps.step} />
            </Box>
            <Box display="flex" justifyContent="flex-end">
              <Inline>{actions}</Inline>
            </Box>
          </Stack>
        </Box>
      </Box>
    </Container>
  );
};

export default WizardInner;
