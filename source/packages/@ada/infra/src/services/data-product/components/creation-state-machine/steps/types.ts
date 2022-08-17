/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CallingUser } from '@ada/common';
import { DataProductEntity } from '@ada/api';
import {
  StepFunctionErrorDetails,
  StepFunctionLambdaEvent,
} from '@ada/microservice-common';

export interface StartDataProductInfraDeploymentEvent {
  readonly dataProduct: DataProductEntity;
  readonly callingUser: CallingUser;
}

export interface CheckDataProductInfraDeploymentStatusEvent extends
StartDataProductInfraDeploymentEvent {
  readonly cloudFormationStackId: string;
}

export interface CheckDataProductInfraDeploymentStatusResult extends
CheckDataProductInfraDeploymentStatusEvent {
  readonly isDeploymentComplete: boolean;
}

export interface DataProductInfraDeploymentFailedEvent extends
StepFunctionLambdaEvent<StartDataProductInfraDeploymentEvent> {
  readonly ErrorDetails: StepFunctionErrorDetails;
}
