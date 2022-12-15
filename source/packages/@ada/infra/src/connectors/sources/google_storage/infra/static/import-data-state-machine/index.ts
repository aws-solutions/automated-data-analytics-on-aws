/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { ContainerDefinition, ICluster, TaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { GOOGLE_BASE_TASK_INPUT } from '@ada/connectors/common/google/infra';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { StateMachine, TaskInput } from 'aws-cdk-lib/aws-stepfunctions';
import BaseEcsRunnerStateMachine from '@ada/connectors/common/common/base-esc-runner-state-machine';

export interface GoogleStorageImportDataStateMachineProps {
  readonly cluster: ICluster;
  readonly taskDefinition: TaskDefinition;
  readonly containerDefinition: ContainerDefinition;
  readonly securityGroup: SecurityGroup;
  readonly vpc: Vpc;
}

/**
 * Construct to create a generic Google Storage Data importer
 */
export default class GoogleStorageImportDataStateMachine extends BaseEcsRunnerStateMachine {
  public readonly stateMachine: StateMachine;

  constructor(scope: Construct, id: string, props: GoogleStorageImportDataStateMachineProps) {
    super(scope, id, {
      ...props,
      taskEnv: TaskInput.fromObject([
        ...GOOGLE_BASE_TASK_INPUT,
        {
          name: 'GS_INPUT_BUCKET_URI',
          value: TaskInput.fromJsonPathAt('$.gcpStorageInputPath').value,
        },
      ]),
    });
  }
}
