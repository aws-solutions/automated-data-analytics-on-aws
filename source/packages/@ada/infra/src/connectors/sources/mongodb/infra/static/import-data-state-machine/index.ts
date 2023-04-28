/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AMAZON_BASE_TASK_INPUT } from '@ada/connectors/common/amazon/infra';
import { Construct } from 'constructs';
import { ContainerDefinition, ICluster, TaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { StateMachine, TaskInput } from 'aws-cdk-lib/aws-stepfunctions';
import BaseEcsRunnerStateMachine from '@ada/connectors/common/common/base-esc-runner-state-machine';

export interface MongoDBImportDataStateMachineProps {
  readonly cluster: ICluster;
  readonly taskDefinition: TaskDefinition;
  readonly containerDefinition: ContainerDefinition;
  readonly securityGroup: SecurityGroup;
  readonly vpc: Vpc;
}

/**
 * Construct to create a generic MongoDB Data importer
 */
export default class MongoDBImportDataStateMachine extends BaseEcsRunnerStateMachine {
  public readonly stateMachine: StateMachine;

  constructor(scope: Construct, id: string, props: MongoDBImportDataStateMachineProps) {
    super(scope, id, {
      ...props,
      taskEnv: TaskInput.fromObject([
        ...AMAZON_BASE_TASK_INPUT,
        {
          name: 'DB_ENDPOINT',
          value: TaskInput.fromJsonPathAt('$.databaseEndpoint').value,
        },
        {
          name: 'DB_PORT',
          value: TaskInput.fromJsonPathAt('$.databasePort').value,
        },
        {
          name: 'DB_NAME',
          value: TaskInput.fromJsonPathAt('$.databaseName').value,
        },
        {
          name: 'COLLECTION_NAME',
          value: TaskInput.fromJsonPathAt('$.collectionName').value,
        },
        {
          name: 'USERNAME',
          value: TaskInput.fromJsonPathAt('$.username').value,
        },
        {
          name: 'PASSWORD',
          value: TaskInput.fromJsonPathAt('$.password').value,
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
          name: 'TLS',
          value: TaskInput.fromJsonPathAt('$.tls').value,
        },
        {
          name: 'TLS_CA_ID',
          value: TaskInput.fromJsonPathAt('$.tlsCA').value,
        },
        {
          name: 'TLS_CLIENT_CERT_ID',
          value: TaskInput.fromJsonPathAt('$.tlsClientCert').value,
        },
        {
          name: 'EXTRA_PARAMS',
          value: TaskInput.fromJsonPathAt('$.extraParams').value,
        },
        {
          name: 'BOOKMARK_FIELD',
          value: TaskInput.fromJsonPathAt('$.bookmarkField').value,
        },
        {
          name: 'BOOKMARK_FIELD_TYPE',
          value: TaskInput.fromJsonPathAt('$.bookmarkFieldType').value,
        },
      ]),
    });
  }
}
