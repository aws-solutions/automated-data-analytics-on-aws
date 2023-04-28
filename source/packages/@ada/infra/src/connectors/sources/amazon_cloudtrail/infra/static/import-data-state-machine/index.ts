/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AMAZON_BASE_TASK_INPUT } from '@ada/connectors/common/amazon/infra';
import { Construct } from 'constructs';
import { ContainerDefinition, ICluster, TaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { StateMachine, TaskInput } from 'aws-cdk-lib/aws-stepfunctions';
import BaseEcsRunnerStateMachine from '@ada/connectors/common/common/base-esc-runner-state-machine';

export interface CloudTrailImportDataStateMachineProps {
  readonly cluster: ICluster;
  readonly taskDefinition: TaskDefinition;
  readonly containerDefinition: ContainerDefinition;
  readonly securityGroup: SecurityGroup;
  readonly vpc: Vpc;
}

/**
 * Construct to create a generic CloudTrail Data importer
 */
export default class CloudTrailImportDataStateMachine extends BaseEcsRunnerStateMachine {
  public readonly stateMachine: StateMachine;

  constructor(scope: Construct, id: string, props: CloudTrailImportDataStateMachineProps) {
    super(scope, id, {
      ...props,
      taskEnv: TaskInput.fromObject([
        ...AMAZON_BASE_TASK_INPUT,
        {
          name: 'CLOUDTRAIL_ARN',
          value: TaskInput.fromJsonPathAt('$.cloudTrailTrailArn').value,
        },
        {
          name: 'CLOUDTRAIL_DATE_FROM',
          value: TaskInput.fromJsonPathAt('$.cloudTrailDateFrom').value,
        },
        {
          name: 'CLOUDTRAIL_DATE_TO',
          value: TaskInput.fromJsonPathAt('$.cloudTrailDateTo').value,
        },
        {
          name: 'CLOUDTRAIL_EVENT_TYPES',
          value: TaskInput.fromJsonPathAt('$.cloudTrailEventTypes').value,
        },
        {
          name: 'CROSS_ACCOUNT_ROLE_ARN',
          value: TaskInput.fromJsonPathAt('$.crossAccountRoleArn').value,
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
      ]),
    }); 
  }
}
