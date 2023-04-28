/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AmazonNativeConnectorSourceTask } from '@ada/connectors/common/amazon/base-stack';
import { Construct } from 'constructs';
import { DynamicInfraStackProps } from '@ada/dynamic-infra/stacks/dynamic-infrastructure-stack-base';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { ISourceDetails__DYNAMODB } from '@ada/connectors/sources/amazon_dynamodb';
import { StaticInfra } from '@ada/infra-common/services';

/**
 * Stack for dynamic infrastructure for a DynamoDB Data Product
 */
export class DynamoDBSourceStack extends AmazonNativeConnectorSourceTask {
  constructor(scope: Construct, id: string, props: DynamicInfraStackProps) {
    const details = props.dataProduct.sourceDetails as ISourceDetails__DYNAMODB;
    const updateTrigger = props.dataProduct.updateTrigger;
    const tableArn = details.dynamoDbTableArn;

    super(scope, id, {
      ...props,
      connectorId: 'dynamodb',
      connectorName: 'Amazon DynamoDB',
      importStepName: 'ImportDynamoDBData',
      importDataStateAccessor: (refs: StaticInfra.Refs.IRecord) => refs.dynamoDBConnector.importDataStateMachine,
      lastUpdatedDetailTableName: (refs: StaticInfra.Refs.IRecord) => refs.dynamoDBConnector.lastUpdatedDetailTableName,
      stateMachineInput: {
        tableArn,
        crossAccountRoleArn: details.crossAccountRoleArn,
        dataProductId: props.dataProduct.dataProductId,
        domainId: props.dataProduct.domainId,
        triggerType: updateTrigger.triggerType,
        scheduleRate: updateTrigger.scheduleRate || '',
      },
    });
    if (details.crossAccountRoleArn) {
      this.staticInfrastructureReferences.dynamoDBConnector.otherConstructs!.ecsTaskRole.addToPrincipalPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: [details.crossAccountRoleArn],
          actions: ['sts:AssumeRole', 'sts:TagSession'],
        }),
      );
    }
  }
}

export default DynamoDBSourceStack;
