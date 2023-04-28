/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AmazonNativeConnectorSourceTask } from '@ada/connectors/common/amazon/base-stack';
import { Construct } from 'constructs';
import { DataProductUpdatePolicy } from '@ada/common';
import { DynamicInfraStackProps } from '@ada/dynamic-infra/stacks/dynamic-infrastructure-stack-base';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { ISourceDetails__CLOUDWATCH } from '../..';
import { StaticInfra } from '@ada/infra-common/services';

/**
 * Stack for dynamic infrastructure for a CloudWatch Data Product
 */
export class CloudWatchSourceStack extends AmazonNativeConnectorSourceTask {
  constructor(scope: Construct, id: string, props: DynamicInfraStackProps) {
    // override this connector to always use APPEND update policy
    props.dataProduct.updateTrigger.updatePolicy = DataProductUpdatePolicy.APPEND;

    const details = props.dataProduct.sourceDetails as ISourceDetails__CLOUDWATCH;
    const updateTrigger = props.dataProduct.updateTrigger;
    const logGroupName = details.cloudwatchLogGroupArn.split(':log-group:')[1].split(':*')[0];

    super(scope, id, {
      ...props,
      connectorId: 'cloudwatch',
      connectorName: 'Amazon CloudWatch',
      importStepName: 'ImportCloudWatchData',
      importDataStateAccessor: (refs: StaticInfra.Refs.IRecord) => refs.cloudWatchConnector.importDataStateMachine,
      lastUpdatedDetailTableName: (refs: StaticInfra.Refs.IRecord) =>
        refs.cloudWatchConnector.lastUpdatedDetailTableName,
      stateMachineInput: {
        cloudwatchLogGroupArn: logGroupName,
        query: details.query,
        since: details.since,
        until: details.until || '',
        dataProductId: props.dataProduct.dataProductId,
        domainId: props.dataProduct.domainId,
        triggerType: updateTrigger.triggerType,
        scheduleRate: updateTrigger.scheduleRate || '',
        crossAccountRoleArn: details.crossAccountRoleArn || '',
      },
    });

    if (details.crossAccountRoleArn) {
      this.staticInfrastructureReferences.cloudWatchConnector.otherConstructs!.ecsTaskRole.addToPrincipalPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: [details.crossAccountRoleArn],
          actions: ['sts:AssumeRole', 'sts:TagSession'],
        }),
      );
    }
  }
}

export default CloudWatchSourceStack;
