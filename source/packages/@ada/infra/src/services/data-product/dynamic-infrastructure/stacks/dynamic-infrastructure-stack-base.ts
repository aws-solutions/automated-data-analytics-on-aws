/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
/** eslint-disable import/order */
import { CatchProps, INextable, IStateMachine, IntegrationPattern, TaskInput } from 'aws-cdk-lib/aws-stepfunctions';
import { CfnOutput } from 'aws-cdk-lib';
import { CompositePrincipal, Effect, PolicyDocument, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import {
  DATA_PRODUCT_DATA_IMPORT_STATE_MACHINE_STACK_OUTPUT_PREFIX,
  DataProductUpdateTriggerType,
  PrincipalTagServiceValue,
} from '@ada/common';
import { DataProductEventDetailTypes, EventSource, s3PathJoin } from '@ada/microservice-common';
import { EventBridgePutEvents, LambdaInvoke, StepFunctionsStartExecution } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { EventLambdaTargetFunction } from '@ada/infra-common/constructs/lambda/lambda-event-target';
import { ExtendedStack, NamespaceGlobalUUID, get4DigitsHash, getFriendlyHash } from '@ada/cdk-core';
import { ExternalFacingRole } from '@ada/infra-common/constructs/iam/external-facing-role';
import { Rule, RuleTargetInput, Schedule } from 'aws-cdk-lib/aws-events';
import { VError } from 'verror';
import ArbitraryTransformLoop from '../constructs/step-functions/arbitrary-transform-loop';
import CommonTasks from '../constructs/step-functions/common-tasks';
import Crawler from '../constructs/glue/crawler';
import StaticInfrastructureReferences from '../constructs/static-infrastructure-references';
import type { DataProductEntity } from '@ada/api';
import type { DynamicInfra, StaticInfra } from '@ada/microservice-common';
import type { StartDataImportInput } from '../lambdas/handlers/start-data-import';

export type DynamicInfraStackProps = DynamicInfra.StackProps;

/**
 * Base CDK stack for dynamic infrastructure for a data product.
 *
 * Inheriting stacks are expected to create a step function state machine which includes the arbitrary transform loop
 * at the appropriate point of the workflow.
 *
 * Inheriting stacks can optionally create an event bridge rule and any other infrastructure to handle an automatic data
 * update for the data product.
 */
export abstract class DynamicInfrastructureStackBase extends ExtendedStack implements DynamicInfra.IStack {
  public readonly staticInfrastructureReferences: StaticInfra.Refs.IRecord;
  public readonly dataProductUniqueIdentifier: string;
  public readonly glueConnectionName: string;
  public readonly dataBucketPath: string;
  public readonly putSuccessEventOnEventBridge: EventBridgePutEvents;
  public readonly putErrorEventOnEventBridge: EventBridgePutEvents;
  public readonly putNoUpdateEventOnEventBridge: EventBridgePutEvents;
  public readonly transformLoop: ArbitraryTransformLoop;
  public readonly defaultTransformRequired: boolean;
  public readonly catchProps: CatchProps = {
    resultPath: '$.ErrorDetails',
  };

  public readonly stackIdentifier: string;

  public readonly role: ExternalFacingRole;

  /**
   * Create a step function state machine to manage ingestion of data for this data product. Expected to include the
   * transform loop upon successful ingestion to apply user-specified and automatic transforms to the data once ingested.
   */
  protected abstract createDataSourceInfrastructureAndStateMachine(props: DynamicInfraStackProps): IStateMachine;

  /**
   * Create the automatic data update trigger rule for this data product. If not supported, this method may throw an
   * error.
   */
  protected abstract createAutomaticDataUpdateTriggerRule(props: DynamicInfraStackProps): Rule;

  /**
   * Set the true to force a default transform (ada_parquet_data_type_map) to execute, if no transforms applied by the User.
   * This will force copying data into s3, which will allow Athena to have visibiity on the created Glue tables.
   * This is required for any data Glue Connection data sources that aren't supported by Athena.
   * See: https://docs.aws.amazon.com/athena/latest/ug/supported-serdes.html
   */

  protected abstract getDefaultTransformRequired(): boolean;

  /**
   * Can be overridden to add additional policy statements to the external facing role
   */
  protected createExternalFacingRoleInlinePolicyStatements(_props: DynamicInfraStackProps): {
    [key: string]: PolicyDocument;
  } {
    return {
      glueTransformsPolicy: new PolicyDocument({
        statements: [
          // Source access role is shared by the crawlers and jobs, since the first crawler and job access the source data
          new PolicyStatement({
            resources: ['*'],
            actions: ['logs:CreateLogGroup', 'logs:PutLogEvents', 'logs:CreateLogStream'],
            effect: Effect.ALLOW,
          }),
          new PolicyStatement({
            resources: ['*'],
            actions: [
              'glue:CreateTable',
              'glue:CreateSchema',
              'glue:CreatePartition*',
              'glue:UpdateTable',
              'glue:UpdateSchema',
              'glue:UpdatePartition',
              'glue:Get*',
              'glue:BatchGet*',
              'glue:BatchCreatePartition',
              'glue:BatchUpdatePartition',
            ],
            effect: Effect.ALLOW,
          }),
          new PolicyStatement({
            resources: [
              'arn:aws:ec2:*:*:network-interface/*',
              'arn:aws:ec2:*:*:security-group/*',
              'arn:aws:ec2:*:*:instance/*',
            ],
            actions: ['ec2:CreateTags', 'ec2:DeleteTags'],
            conditions: {
              'ForAllValues:StringEquals': {
                'aws:TagKeys': ['aws-glue-service-resource'],
              },
            },
            effect: Effect.ALLOW,
          }),
          new PolicyStatement({
            resources: ['*'],
            actions: [
              'glue:*',
              's3:GetBucketLocation',
              's3:ListBucket',
              's3:ListAllMyBuckets',
              's3:GetBucketAcl',
              'ec2:DescribeVpcEndpoints',
              'ec2:DescribeRouteTables',
              'ec2:CreateNetworkInterface',
              'ec2:DeleteNetworkInterface',
              'ec2:DescribeNetworkInterfaces',
              'ec2:DescribeSecurityGroups',
              'ec2:DescribeSubnets',
              'ec2:DescribeVpcAttribute',
              'iam:ListRolePolicies',
              'iam:GetRole',
              'iam:GetRolePolicy',
              'cloudwatch:PutMetricData',
            ],
            effect: Effect.ALLOW,
          }),
        ],
      }),
    };
  }

  // override this function if the connector will need to specify connection to the glue transform
  protected getConnectionName(): string {
    return '';
  }

  protected constructor(scope: Construct, id: string, props: DynamicInfraStackProps) {
    super(scope, id, {
      ...props,
      // Must have concrete environment for events
      // https://docs.aws.amazon.com/cdk/v2/guide/environments.html
      // https://github.com/aws/aws-cdk/blob/5bad3aaac6cc7cc7befb8bdd320181a7c650f15d/packages/%40aws-cdk/aws-events/lib/rule.ts#L202
      // passed to step-function lambda source/packages/@ada/infra/src/services/data-product/components/creation-state-machine/index.ts
      env: {
        account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION,
        ...props.env,
      },
    });
    this.stackIdentifier = id;
    const { dataProduct, callingUser, staticInfrastructure, additionalNotificationPayload } = props;

    // Store reference to globalHash from core stack to be used in explicit name hashing
    NamespaceGlobalUUID.storeGlobalHash(this, staticInfrastructure.globalHash);

    this.stackIdentifier = id;

    const { staticInfrastructureReferences } = new StaticInfrastructureReferences(this, 'StaticInfrastructure', {
      staticInfrastructure,
    });
    this.staticInfrastructureReferences = staticInfrastructureReferences;
    const { notificationBus, startDataImportLambda, dataBucket } = staticInfrastructureReferences;
    const { domainId, dataProductId, updateTrigger } = dataProduct;
    this.dataBucketPath = s3PathJoin(domainId, dataProductId, this.stackIdentifier);

    // Include a hash of the stack identifier to ensure that creating a data product with the same id of a previously
    // deleted data product will not clash
    this.dataProductUniqueIdentifier = `${getFriendlyHash(dataProduct.domainId)}${getFriendlyHash(
      dataProduct.dataProductId,
    )}${get4DigitsHash(this.stackIdentifier)}`.replace(/_/g, '-');

    this.glueConnectionName = this.getConnectionName();

    this.defaultTransformRequired = this.getDefaultTransformRequired();

    const { putSuccessEventOnEventBridge, putErrorEventOnEventBridge, putNoUpdateEventOnEventBridge } = new CommonTasks(
      this,
      'CommonTasks',
      {
        callingUser,
        staticInfrastructureReferences,
        dataProduct,
        additionalNotificationPayload,
      },
    );
    this.putErrorEventOnEventBridge = putErrorEventOnEventBridge;
    this.putSuccessEventOnEventBridge = putSuccessEventOnEventBridge;
    this.putNoUpdateEventOnEventBridge = putNoUpdateEventOnEventBridge;

    this.role = new ExternalFacingRole(this, 'SourceAccessRole', {
      service: PrincipalTagServiceValue.DATA_PRODUCT,
      callingUser,
      assumedBy: new CompositePrincipal(
        new ServicePrincipal('glue.amazonaws.com'),
        new ServicePrincipal('states.amazonaws.com'),
      ),
      inlinePolicies: this.createExternalFacingRoleInlinePolicyStatements(props),
    });
    dataBucket.grantReadWrite(this.role, `${this.dataBucketPath}/*`);

    this.transformLoop = new ArbitraryTransformLoop(this, 'ArbitraryTransforms', {
      dataProductUniqueIdentifier: this.dataProductUniqueIdentifier,
      dataBucketPath: this.dataBucketPath,
      staticInfrastructureReferences,
      dataProduct,
      callingUser,
      putSuccessEventOnEventBridge,
      putErrorEventOnEventBridge,
      sourceAccessRole: this.role,
      glueConnectionNames: this.glueConnectionName ? [this.glueConnectionName] : undefined,
      defaultTransformRequired: this.defaultTransformRequired,
      extraJobArgs: props.extraJobArgs,
    });

    const stateMachine = this.createDataSourceInfrastructureAndStateMachine(props);
    this.transformLoop.transformJobsAndCrawlers.grantStartJobRuns(stateMachine);

    // Export the state machine arn as an output so that its status can be retrieved if necessary.
    new CfnOutput(this, 'StateMachineArn', {
      exportName: `${DATA_PRODUCT_DATA_IMPORT_STATE_MACHINE_STACK_OUTPUT_PREFIX}${this.dataProductUniqueIdentifier}`,
      value: stateMachine.stateMachineArn,
    });

    // application based events are coming from a dedicated bus
    const onDemandUpdateRule = notificationBus.addRule('DataProductOnDemandUpdateRule', {
      // ruleName: `${this.dataProductUniqueIdentifier}-on-demand-update`,
      description: `On demand updates for ${dataProduct.name}`,
      notificationPattern: {
        source: [EventSource.DATA_PRODUCTS],
        type: [DataProductEventDetailTypes.DATA_PRODUCT_ON_DEMAND_UPDATE],
        payload: {
          domainId: [domainId],
          dataProductId: [dataProductId],
        },
      },
    });

    // Lambda used to trigger the step function for data imports
    const startDataImportTarget = new EventLambdaTargetFunction(startDataImportLambda, {
      event: RuleTargetInput.fromObject(<StartDataImportInput>{
        stateMachineArn: stateMachine.stateMachineArn,
        dataProductIdentifier: { domainId, dataProductId },
        callingUser,
      }),
    });

    onDemandUpdateRule.addTarget(startDataImportTarget);

    switch (updateTrigger.triggerType) {
      case DataProductUpdateTriggerType.AUTOMATIC: {
        const automaticUpdateRule = this.createAutomaticDataUpdateTriggerRule(props);
        automaticUpdateRule.addTarget(startDataImportTarget);
        break;
      }
      case DataProductUpdateTriggerType.SCHEDULE: {
        // schedule events can only be added to the default bus
        const scheduleUpdateRule = new Rule(this, 'DataProductScheduledRule', {
          // ruleName: `${this.dataProductUniqueIdentifier}-scheduled-event-rule`,
          description: `Scheduled event rule for S3 data source`,
          schedule: Schedule.expression(updateTrigger.scheduleRate!),
          // scheduled events do need to include a event patter expression
        });
        scheduleUpdateRule.addTarget(startDataImportTarget);
        break;
      }
      case DataProductUpdateTriggerType.ON_DEMAND: {
        break;
      }
      default: {
        throw new VError({ name: 'UnsupportedTriggerTypeError' }, 'Unsupported TriggerType');
      }
    }
  }

  protected buildPrepareImportExternalStep = (
    crawler: Crawler,
    dataProduct: DataProductEntity,
    tablePrefix: string,
    outputS3Path: string,
  ): INextable => {
    return new LambdaInvoke(this, 'PrepareImportExternal', {
      lambdaFunction: this.staticInfrastructureReferences.prepareExternalImportLambda,
      payload: TaskInput.fromObject({
        Payload: {
          crawlerName: crawler.crawler.name,
          tablePrefix,
          outputS3Path,
          dataProduct,
        },
      }),
    }).addCatch(this.putErrorEventOnEventBridge, this.catchProps);
  };

  /**
   * Build a step for discovering the crawled tables given the table prefix
   * @param tablePrefix the prefix to check
   * @param id id to add to the construct id
   * @param additionalPayload any additional items to add to the payload
   */
  protected buildDiscoverCrawledTableStep = (
    tablePrefix: string,
    id?: string,
    additionalPayload?: { [key: string]: any },
  ): INextable =>
    new LambdaInvoke(this, `GetCrawledTableDetailsFor${id || tablePrefix}`, {
      lambdaFunction: this.staticInfrastructureReferences.getCrawledTableDetailsLambda,
      payload: TaskInput.fromObject({
        Payload: {
          databaseName: this.staticInfrastructureReferences.glueDBArn.resourceName,
          tablePrefix: tablePrefix,
          ...additionalPayload,
        },
      }),
    }).addCatch(this.putErrorEventOnEventBridge, this.catchProps);

  /**
   * Build a step to execute the given crawler
   * @param crawler the crawler to execute
   * @param resultPath where to save execute crawler results in the sfn state
   */
  protected buildExecuteCrawlerStep = (crawler: Crawler, resultPath?: string) => {
    const crawlerName = crawler.crawler.name;
    return new StepFunctionsStartExecution(this, `ExecuteCrawler${crawlerName}`, {
      stateMachine: this.staticInfrastructureReferences.crawlerStateMachine,
      input: TaskInput.fromObject({
        crawlerName,
      }),
      integrationPattern: IntegrationPattern.RUN_JOB,
      resultPath,
    }).addCatch(this.putErrorEventOnEventBridge, this.catchProps);
  };

  /**
   * Create steps for executing a crawler and discovering the tables it created
   * @param crawler the crawler to execute
   */
  protected buildExecuteCrawlerAndDiscoverCrawledTableSteps = (crawler: Crawler) => {
    const executeCrawler = this.buildExecuteCrawlerStep(crawler);
    const getCrawledTableDetails = this.buildDiscoverCrawledTableStep(crawler.tablePrefix);

    return { executeCrawler, getCrawledTableDetails };
  };
}

export default DynamicInfrastructureStackBase;
