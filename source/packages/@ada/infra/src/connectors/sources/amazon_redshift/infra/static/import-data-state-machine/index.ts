/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AMAZON_BASE_TASK_INPUT } from '@ada/connectors/common/amazon/infra';
import { Construct } from 'constructs';
import { ContainerDefinition, ICluster, TaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { StateMachine, TaskInput } from 'aws-cdk-lib/aws-stepfunctions';
import BaseEcsRunnerStateMachine from '@ada/connectors/common/common/base-esc-runner-state-machine';

export interface RedshiftImportDataStateMachineProps {
  readonly cluster: ICluster;
  readonly taskDefinition: TaskDefinition;
  readonly containerDefinition: ContainerDefinition;
  readonly securityGroup: SecurityGroup;
  readonly vpc: Vpc;
}

/**
 * Construct to create a generic Redshift Data importer
 */
export default class RedshiftImportDataStateMachine extends BaseEcsRunnerStateMachine {
  public readonly stateMachine: StateMachine;

  constructor(scope: Construct, id: string, props: RedshiftImportDataStateMachineProps) {
    super(scope, id, {
      ...props,
      taskEnv: TaskInput.fromObject([
        ...AMAZON_BASE_TASK_INPUT,
        {
          name: 'DATABASE_ENDPOINT',
          value: TaskInput.fromJsonPathAt('$.databaseEndpoint').value,
        },
        {
          name: 'DATABASE_PORT',
          value: TaskInput.fromJsonPathAt('$.databasePort').value,
        },
        {
          name: 'DATABASE_NAME',
          value: TaskInput.fromJsonPathAt('$.databaseName').value,
        },
        {
          name: 'DATABASE_TABLE',
          value: TaskInput.fromJsonPathAt('$.databaseTable').value,
        },
        {
          name: 'DATABASE_TYPE',
          value: TaskInput.fromJsonPathAt('$.databaseType').value,
        },
        {
          name: 'WORKGROUP',
          value: TaskInput.fromJsonPathAt('$.workgroup').value,
        },
        {
          name: 'DATABASE_USERNAME',
          value: TaskInput.fromJsonPathAt('$.databaseUsername').value,
        },
        {
          name: 'CLUSTER_IDENTIFIER',
          value: TaskInput.fromJsonPathAt('$.clusterIdentifier').value,
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
