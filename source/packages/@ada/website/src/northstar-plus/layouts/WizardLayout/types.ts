/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { WizardActionCallback } from './components/WizardInner';
import { WizardStepInfo } from 'aws-northstar/components/Wizard';
import { WizardStepProps } from '$northstar-plus/layouts/WizardLayout/components/WizardStep';

export type BaseWizardStepProps = Required<Pick<WizardStepProps, 'title' | 'fields'>> &
  Partial<Omit<WizardStepProps, 'onNextButtonClick' | 'onPreviousButtonClick'>> & {
    nextButtonText?: string;
    onNextButtonClick?: WizardActionCallback;
    previousButtonText?: string;
    onPreviousButtonClick?: WizardActionCallback;
  };

export type WizardStep = BaseWizardStepProps & Partial<Omit<WizardStepInfo, 'title'>>;
