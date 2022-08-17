/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CheckDataProductInfraDeploymentStatusEvent, CheckDataProductInfraDeploymentStatusResult } from './types';
import { Logger } from '@ada/infra-common/constructs/lambda/lambda-logger';
import { StepFunctionLambdaEvent } from '../../../../../common/services';
import { describeStack, isTerminalStatus } from '../../../dynamic-infrastructure/cdk';



/**
 * Check whether the deployment of data product infrastructure has completed or not
 * @param event step function state after starting deployment
 * @param context lambda context
 */
export const handler = async (
  event: StepFunctionLambdaEvent<CheckDataProductInfraDeploymentStatusEvent>,
  context: any,
): Promise<CheckDataProductInfraDeploymentStatusResult> => {
  const { cloudFormationStackId } = event.Payload;
  const log = Logger.getLogger({
    lambda: {
      event,
      context,
    },
  });

  const stack = await describeStack(cloudFormationStackId);
  log.info('Stack details', { cloudFormationStackId, stack });

  return {
    ...event.Payload,
    isDeploymentComplete: isTerminalStatus(stack),
  };
};
