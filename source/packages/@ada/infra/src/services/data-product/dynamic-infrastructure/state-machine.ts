/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsStepFunctionsInstance } from '@ada/aws-sdk';
import { CallingUser } from '@ada/common';
import { DataProductEntity } from '@ada/api';
import { Logger } from '@ada/infra-common/constructs/lambda/lambda-logger';
import { StartDataProductInfraDeploymentEvent } from '../components/creation-state-machine/steps/types';
import { StepFunctionLambdaEvent } from '../../../common/services';

const log = Logger.getLogger({ tags: ['PersistNotifications'] });

const CREATE_DATA_PRODUCT_STATE_MACHINE_ARN = process.env.CREATE_DATA_PRODUCT_STATE_MACHINE_ARN ?? '';

const sfn = AwsStepFunctionsInstance();

/**
 * Start the creation of dynamic data product infrastructure
 * @param callingUser the user that created the data product
 * @param dataProduct the data product for which the infrastructure is being created
 */
export const startDynamicInfrastructureCreation = async (callingUser: CallingUser, dataProduct: DataProductEntity) => {
  const createDataProductInfraInput: StepFunctionLambdaEvent<StartDataProductInfraDeploymentEvent> = {
    Payload: {
      dataProduct,
      callingUser,
    },
  };

  // Start the step function execution to create the data product dynamic infrastructure
  log.info(`Starting stateMachineArn: ${CREATE_DATA_PRODUCT_STATE_MACHINE_ARN}`);
  await sfn
    .startExecution({
      stateMachineArn: CREATE_DATA_PRODUCT_STATE_MACHINE_ARN,
      input: JSON.stringify(createDataProductInfraInput),
    })
    .promise();
};
