/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AmazonNativeConnectorSourceTask } from '@ada/connectors/common/amazon/base-stack';
import { Construct } from 'constructs';
import { DynamicInfraStackProps } from '@ada/dynamic-infra/stacks/dynamic-infrastructure-stack-base';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { ISourceDetails__REDSHIFT } from '@ada/connectors/sources/amazon_redshift';
import { StaticInfra } from '@ada/infra-common/services';

/**
 * Stack for dynamic infrastructure for a Redshift Data Product
 */
export class RedshiftSourceStack extends AmazonNativeConnectorSourceTask {
  constructor(scope: Construct, id: string, props: DynamicInfraStackProps) {
    const details = props.dataProduct.sourceDetails as ISourceDetails__REDSHIFT;
    const updateTrigger = props.dataProduct.updateTrigger;
    const { databaseEndpoint, databaseName, 
      databasePort, databaseTable, 
      databaseType, databaseUsername, 
      clusterIdentifier, workgroup, 
      crossAccountRoleArn } = details;

    super(scope, id, {
      ...props,
      connectorId: 'redshift',
      connectorName: 'Amazon Redshift',
      importStepName: 'ImportRedshiftData',
      importDataStateAccessor: (refs: StaticInfra.Refs.IRecord) => refs.redshiftConnector.importDataStateMachine,
      lastUpdatedDetailTableName: (refs: StaticInfra.Refs.IRecord) => refs.redshiftConnector.lastUpdatedDetailTableName,
      stateMachineInput: {
        databaseEndpoint,
        databasePort,
        databaseName,
        databaseTable,
        databaseType,
        workgroup,
        databaseUsername,
        clusterIdentifier,
        dataProductId: props.dataProduct.dataProductId,
        crossAccountRoleArn: crossAccountRoleArn || '',
        domainId: props.dataProduct.domainId,
        triggerType: updateTrigger.triggerType,
        scheduleRate: updateTrigger.scheduleRate || '',
      },
    });
    
    if (details.crossAccountRoleArn) {
      this.staticInfrastructureReferences.redshiftConnector.otherConstructs!.ecsTaskRole.addToPrincipalPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: [details.crossAccountRoleArn],
          actions: ['sts:AssumeRole', 'sts:TagSession'],
        }),
      );
    }
  }
}

export default RedshiftSourceStack;
