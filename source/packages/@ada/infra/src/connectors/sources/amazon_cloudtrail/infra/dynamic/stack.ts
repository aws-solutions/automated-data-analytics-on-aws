/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AmazonNativeConnectorSourceTask } from '@ada/connectors/common/amazon/base-stack';
import { Construct } from 'constructs';
import { DataProductUpdatePolicy } from '@ada/common';
import { DynamicInfraStackProps } from '@ada/dynamic-infra/stacks/dynamic-infrastructure-stack-base';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { ISourceDetails__CLOUDTRAIL } from '../..';
import { StaticInfra } from '@ada/infra-common/services';

/**
 * Stack for dynamic infrastructure for a CloudTrail Data Product
 */
export class CloudTrailSourceStack extends AmazonNativeConnectorSourceTask {
  constructor(scope: Construct, id: string, props: DynamicInfraStackProps) {
    // override this connector to always use APPEND update policy
    props.dataProduct.updateTrigger.updatePolicy = DataProductUpdatePolicy.APPEND;

    const details = props.dataProduct.sourceDetails as ISourceDetails__CLOUDTRAIL;
    const updateTrigger = props.dataProduct.updateTrigger;

    super(scope, id, {
      ...props,
      connectorId: 'cloudtrail',
      connectorName: 'Amazon CloudTrail',
      importStepName: 'ImportCloudTrailData',
      importDataStateAccessor: (refs: StaticInfra.Refs.IRecord) => refs.cloudTrailConnector.importDataStateMachine,
      lastUpdatedDetailTableName: (refs: StaticInfra.Refs.IRecord) =>
        refs.cloudTrailConnector.lastUpdatedDetailTableName,
      stateMachineInput: {
        cloudTrailTrailArn: details.cloudTrailTrailArn,
        cloudTrailEventTypes: details.cloudTrailEventTypes,
        cloudTrailDateFrom: details.cloudTrailDateFrom,
        cloudTrailDateTo: details.cloudTrailDateTo || '',
        crossAccountRoleArn: details.crossAccountRoleArn || '',
        dataProductId: props.dataProduct.dataProductId,
        domainId: props.dataProduct.domainId,
        triggerType: updateTrigger.triggerType,
        scheduleRate: updateTrigger.scheduleRate || '',
      },
    });

    if (details.crossAccountRoleArn) {
      this.staticInfrastructureReferences.cloudTrailConnector.otherConstructs!.ecsTaskRole.addToPrincipalPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: [details.crossAccountRoleArn],
          actions: ['sts:AssumeRole', 'sts:TagSession'],
        }),
      );
    }
  }
}

export default CloudTrailSourceStack;
