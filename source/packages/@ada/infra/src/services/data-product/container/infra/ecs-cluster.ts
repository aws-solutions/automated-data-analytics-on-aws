/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  Cluster,
  Compatibility,
  ContainerDefinition,
  LogDriver,
  NetworkMode,
  TaskDefinition,
} from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { LogGroup } from '../../../../common/constructs/cloudwatch/log-group';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { TarballImageAsset } from '../../../../common/constructs/ecr-assets/tarball-image-asset';
import { addCfnNagSuppressionsToRolePolicy } from '@ada/cdk-core';

export interface DataIngressECSClusterProps {
  readonly name: string;
  readonly vpc: Vpc;
  readonly securityGroup: SecurityGroup;
  readonly taskDefinitionRole: Role;
  readonly cpu: number;
  readonly memoryMiB: number;
  readonly imageTarballPath: string;
}

export class DataIngressECSCluster extends Construct {
  public readonly taskExecutionRole: Role;

  public readonly taskDefinition: TaskDefinition;

  public readonly containerDefinition: ContainerDefinition;

  public readonly cluster: Cluster;

  constructor(scope: Construct, id: string, props: DataIngressECSClusterProps) {
    super(scope, id);

    const { name, vpc, taskDefinitionRole, cpu, memoryMiB, imageTarballPath } = props;

    this.cluster = new Cluster(this, `ECSCluster-${name}`, {
      vpc,
      containerInsights: true,
    });

    this.taskExecutionRole = new Role(this, `ECSExecutionRole-${name}`, {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    this.taskExecutionRole.addToPolicy(
      new PolicyStatement({
        resources: ['*'],
        actions: ['logs:PutLogEvents', 'logs:CreateLogStream'],
        effect: Effect.ALLOW,
      }),
    );
    this.taskExecutionRole.addToPolicy(
      new PolicyStatement({
        resources: ['*'],
        actions: ['ecr:GetAuthorizationToken'],
        effect: Effect.ALLOW,
      }),
    );
    addCfnNagSuppressionsToRolePolicy(this.taskExecutionRole, [
      {
        id: 'W12',
        reason: '* resource required to create log streams',
      },
    ]);

    this.taskDefinition = new TaskDefinition(this, `ECSTaskDefinition-${name}`, {
      taskRole: taskDefinitionRole,
      executionRole: this.taskExecutionRole,
      networkMode: NetworkMode.AWS_VPC,
      compatibility: Compatibility.FARGATE,
      cpu: `${cpu}`,
      memoryMiB: `${memoryMiB}`,
    });

    // containerDef
    this.containerDefinition = this.taskDefinition.addContainer(`ECSContainerDef-${name}`, {
      image: TarballImageAsset.containerImageFromTarball(imageTarballPath),
      cpu,
      memoryReservationMiB: memoryMiB,
      logging: LogDriver.awsLogs({
        streamPrefix: `ecs-${name}`,
        logGroup: new LogGroup(this, `ECSContainerLogGroup-${name}`),
      }),
      environment: {},
    });
  }
}
