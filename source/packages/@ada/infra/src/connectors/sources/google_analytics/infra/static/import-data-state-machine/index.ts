/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { ContainerDefinition, ICluster, TaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { GOOGLE_BASE_TASK_INPUT } from '../../../../../common/google/infra';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { TaskInput } from 'aws-cdk-lib/aws-stepfunctions';
import BaseEcsRunnerStateMachine from '@ada/connectors/common/common/base-esc-runner-state-machine';

export interface GoogleAnalyticsImportDataStateMachineProps {
  readonly cluster: ICluster;
  readonly taskDefinition: TaskDefinition;
  readonly containerDefinition: ContainerDefinition;
  readonly securityGroup: SecurityGroup;
  readonly vpc: Vpc;
}

/**
 * Construct to create a generic Google Analytics Data importer
 */
export default class GoogleAnalyticsImportDataStateMachine extends BaseEcsRunnerStateMachine {
  constructor(scope: Construct, id: string, props: GoogleAnalyticsImportDataStateMachineProps) {
    super(scope, id, {
      ...props,
      taskEnv: TaskInput.fromObject([
        ...GOOGLE_BASE_TASK_INPUT,
        {
          name: 'VIEW_ID',
          value: TaskInput.fromJsonPathAt('$.viewId').value,
        },
        {
          name: 'SINCE',
          value: TaskInput.fromJsonPathAt('$.since').value,
        },
        {
          name: 'UNTIL',
          value: TaskInput.fromJsonPathAt('$.until').value,
        },
        {
          name: 'DIMENSIONS',
          value: TaskInput.fromJsonPathAt('$.dimensions').value,
        },
        {
          name: 'METRICS',
          value: TaskInput.fromJsonPathAt('$.metrics').value,
        },
        {
          name: 'TRIGGER_TYPE',
          value: TaskInput.fromJsonPathAt('$.triggerType').value,
        },
        {
          name: 'SCHEDULE_RATE',
          value: TaskInput.fromJsonPathAt('$.scheduleRate').value,
        },
      ]),
    });
  }
}
