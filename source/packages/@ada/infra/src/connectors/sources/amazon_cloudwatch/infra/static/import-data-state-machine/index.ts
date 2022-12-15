/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AMAZON_BASE_TASK_INPUT } from '@ada/connectors/common/amazon/infra';
import { Construct } from 'constructs';
import { ContainerDefinition, ICluster, TaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { StateMachine, TaskInput } from 'aws-cdk-lib/aws-stepfunctions';
import BaseEcsRunnerStateMachine from '@ada/connectors/common/common/base-esc-runner-state-machine';

export interface CloudWatchImportDataStateMachineProps {
  readonly cluster: ICluster;
  readonly taskDefinition: TaskDefinition;
  readonly containerDefinition: ContainerDefinition;
  readonly securityGroup: SecurityGroup;
  readonly vpc: Vpc;
}

/**
 * Construct to create a generic CloudWatch Data importer
 */
export default class CloudWatchImportDataStateMachine extends BaseEcsRunnerStateMachine {
  public readonly stateMachine: StateMachine;

  constructor(scope: Construct, id: string, props: CloudWatchImportDataStateMachineProps) {
    super(scope, id, {
      ...props,
      taskEnv: TaskInput.fromObject([
        ...AMAZON_BASE_TASK_INPUT,
        {
          name: 'QUERY',
          value: TaskInput.fromJsonPathAt('$.query').value,
        },
        {
          name: 'CW_LOG_GROUP_NAME',
          value: TaskInput.fromJsonPathAt('$.cloudwatchLogGroupArn').value,
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
          name: 'TABLE_NAME',
          value: TaskInput.fromJsonPathAt('$.tableName').value,
        },
        {
          name: 'DOMAIN_ID',
          value: TaskInput.fromJsonPathAt('$.domainId').value,
        },
        {
          name: 'DATA_PRODUCT_ID',
          value: TaskInput.fromJsonPathAt('$.dataProductId').value,
        },
        {
          name: 'CROSS_ACCOUNT_ACCESS_ROLE',
          value: TaskInput.fromJsonPathAt('$.crossAccountRoleArn').value,
        },
      ]),
    });
  }
}
