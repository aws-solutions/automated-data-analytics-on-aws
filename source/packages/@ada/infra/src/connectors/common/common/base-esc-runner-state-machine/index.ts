/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { ContainerDefinition, FargatePlatformVersion, ICluster, TaskDefinition } from 'aws-cdk-lib/aws-ecs';
import {
  DefinitionBody,
  IntegrationPattern,
  LogLevel,
  Pass,
  StateMachine,
  TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { EcsFargateLaunchTarget, EcsRunTask, EcsRunTaskProps } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { LogGroup } from '../../../../common/constructs/cloudwatch/log-group';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { getUniqueStateMachineLogGroupName } from '@ada/cdk-core';

export interface BaseEcsRunnerStateMachineProps {
  readonly cluster: ICluster;
  readonly taskDefinition: TaskDefinition;
  readonly containerDefinition: ContainerDefinition;
  readonly securityGroup: SecurityGroup;
  readonly vpc: Vpc;
  readonly taskEnv: TaskInput;
}

/**
 * Construct to create a generic ECS Based Data importer
 */
export default class BaseEcsRunnerStateMachine extends Construct {
  public readonly stateMachine: StateMachine;

  constructor(scope: Construct, id: string, props: BaseEcsRunnerStateMachineProps) {
    super(scope, id);

    const { cluster, taskDefinition, securityGroup, vpc, containerDefinition, taskEnv } = props;

    const failure = new Pass(this, 'ECSTaskFailed', {
      parameters: {
        'details.$': '$',
        error: 'Import failed in the ECS container, verify the logs',
        status: 'FAILED',
      },
    });

    const success = new Pass(this, 'ECSTaskSucceeded', {
      parameters: {
        status: 'SUCCEEDED',
      },
    });

    const ecsImportTask = new TaggableEcsRunTask(this, 'RunECSImportTask', {
      integrationPattern: IntegrationPattern.RUN_JOB,
      cluster,
      launchTarget: new EcsFargateLaunchTarget({
        platformVersion: FargatePlatformVersion.LATEST,
      }),
      taskDefinition,
      securityGroups: [securityGroup],
      subnets: {
        subnets: vpc.privateSubnets,
      },
      assignPublicIp: false,
      containerOverrides: [
        {
          containerDefinition,
          environment: taskEnv.value,
        },
      ],
    });

    const definition = ecsImportTask
      .addCatch(failure, {
        errors: ['States.ALL'],
      })
      .next(success);

    this.stateMachine = new StateMachine(this, 'StateMachine', {
      definitionBody: DefinitionBody.fromChainable(definition),
      tracingEnabled: true,
      // NOTE: depending on the amount of data this might take more. Find the right timeout?
      timeout: Duration.days(2),
      logs: {
        destination: new LogGroup(this, 'StateMachineLogs', {
          logGroupName: getUniqueStateMachineLogGroupName(this, `${id}StateMachineLogs`),
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        level: LogLevel.ERROR,
      },
    });
  }
}

// https://github.com/aws/aws-cdk/issues/14553
class TaggableEcsRunTask extends EcsRunTask {
  constructor(scope: Construct, id: string, props: EcsRunTaskProps) {
    super(scope, id, props);
  }

  protected _renderTask(): any {
    const orig = super._renderTask();
    const ret = {};
    Object.assign(ret, orig, { Parameters: { PropagateTags: 'TASK_DEFINITION', ...orig.Parameters } });
    return ret;
  }
}
