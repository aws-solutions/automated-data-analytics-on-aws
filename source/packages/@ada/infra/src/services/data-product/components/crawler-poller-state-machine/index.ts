/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  Choice,
  Condition,
  DefinitionBody,
  LogLevel,
  Pass,
  StateMachine,
  TaskInput,
  Wait,
  WaitTime,
} from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { LogGroup } from '../../../../common/constructs/cloudwatch/log-group';
import { TypescriptFunction } from '@ada/infra-common';
import { getUniqueStateMachineLogGroupName } from '@ada/cdk-core';

const { stringEquals } = Condition;

/**
 * Construct to create our generic crawler state machine
 */
export class CrawlerPollerStateMachine extends Construct {
  public readonly stateMachine: StateMachine;
  public readonly stepLambdas: LambdaFunction[] = [];

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const buildLambda = (handlerFile: string) => {
      const lambda = new TypescriptFunction(this, `Lambda-${handlerFile}`, {
        package: 'data-product-service',
        handlerFile: require.resolve(`./steps/${handlerFile}`),
      });
      this.stepLambdas.push(lambda);
      lambda.addToRolePolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['glue:StartCrawler*', 'glue:GetCrawler*'],
          resources: [Stack.of(this).formatArn({ resource: 'crawler/*', service: 'glue' })],
        }),
      );
      return lambda;
    };

    // Lambda to trigger crawling
    const startCrawl = buildLambda('start-crawler');

    // Lambda to check status of whether the crawler's state is READY
    const getStatusLambda = buildLambda('get-status');

    // Lambda to check status of whether the crawl's last crawl succeeded
    const getFinalStatusLambda = buildLambda('get-final-status');

    const submitCrawl = new LambdaInvoke(this, 'SubmitCrawl', {
      lambdaFunction: startCrawl,
      payload: TaskInput.fromObject({
        Payload: {
          crawlerName: TaskInput.fromJsonPathAt('$.crawlerName').value,
        },
      }),
    });

    const waitX = new Wait(this, 'Wait5Seconds', {
      time: WaitTime.duration(Duration.seconds(5)),
    });

    const getStatus = new LambdaInvoke(this, 'GetCrawlStatus', {
      lambdaFunction: getStatusLambda,
    });

    const finalStatus = new LambdaInvoke(this, 'GetFinalCrawlStatus', {
      lambdaFunction: getFinalStatusLambda,
    });

    const failure = new Pass(this, 'CrawlFailed', {
      parameters: {
        Payload: {
          'crawlerName.$': '$.Payload.crawlerName',
          'error.$': '$.Payload.error',
          status: 'FAILED',
        },
      },
    });

    const definition = submitCrawl
      .addCatch(failure, {
        errors: ['States.ALL'],
        resultPath: '$.Payload.error',
      })
      .next(waitX)
      .next(getStatus)
      .next(
        new Choice(this, 'CrawlComplete?')
          // Look at the "status" field
          .when(stringEquals('$.Payload.status', 'FAILED'), failure)
          .when(stringEquals('$.Payload.status', 'SUCCEEDED'), finalStatus)
          .otherwise(waitX),
      );

    this.stateMachine = new StateMachine(this, 'StateMachine', {
      definitionBody: DefinitionBody.fromChainable(definition),
      tracingEnabled: true,
      timeout: Duration.minutes(10),
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

export default CrawlerPollerStateMachine;
