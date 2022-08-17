/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { ContainerDefinition, ICluster, TaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { GOOGLE_BASE_TASK_INPUT } from '../common/google';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { TaskInput } from 'aws-cdk-lib/aws-stepfunctions';
import BaseEcsRunnerStateMachine from '../base-esc-runner-state-machine';

export interface GoogleBigQueryImportDataStateMachineProps {
  readonly cluster: ICluster;
  readonly taskDefinition: TaskDefinition;
  readonly containerDefinition: ContainerDefinition;
  readonly securityGroup: SecurityGroup;
  readonly vpc: Vpc;
}

/**
 * Construct to create a generic Google BigQuery Data importer
 */
export default class GoogleBigQueryImportDataStateMachine extends BaseEcsRunnerStateMachine {
  constructor(scope: Construct, id: string, props: GoogleBigQueryImportDataStateMachineProps) {
    super(scope, id, {
      ...props,
      taskEnv: TaskInput.fromObject([
        ...GOOGLE_BASE_TASK_INPUT,
        {
          name: 'QUERY',
          value: TaskInput.fromJsonPathAt('$.query').value,
        },
      ]),
    });
  }
}
