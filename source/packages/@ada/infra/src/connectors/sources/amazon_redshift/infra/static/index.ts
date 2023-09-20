/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Connectors } from '@ada/connectors/interface';
import { Construct } from 'constructs';
import { DataIngressECSCluster } from '@ada/services/data-product/container/infra/ecs-cluster';
import { ExternalSourceRedshiftAccessPolicyStatement, getDockerImagePath } from '@ada/infra-common';
import { ID } from '../..';
import { Role } from 'aws-cdk-lib/aws-iam';
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import {
  addCfnNagSuppressionsToRolePolicy,
} from '@ada/cdk-core';
import ImportDataStateMachine from './import-data-state-machine';
import type { StaticInfra } from '@ada/data-product-infra-types';

/* eslint-disable max-len */

////////////////////////////////////////////
// CONNECTOR STATIC INFRA - the actual static infrastructure deployed for this connector
////////////////////////////////////////////
export const ConnectorIntegrator: Connectors.Infra.Static.Integrator<typeof ID> = {
  ID,
  staticInfra: (constructor) => {
    return class StaticInfrastructureStack extends constructor implements Connectors.Infra.StaticStackFor<typeof ID> {
      amazonRedshiftECSCluster: DataIngressECSCluster;
      readonly amazonRedshiftImportDataStateMachine: ImportDataStateMachine;

      public override readonly staticInfraParameterValue: InstanceType<
        typeof constructor
      >['staticInfraParameterValue'] &
        Connectors.Infra.ParamsFor<typeof ID>;

      constructor(scope: Construct, id: string, props: StaticInfra.Stack.IConstructProps) {
        super(scope, id, props);

        ////////////////////////////////////////////
        // STATIC INFRA
        ////////////////////////////////////////////
        this.amazonRedshiftECSCluster = this.ingressContainerInfra.createCluster('Redshift', {
          // NOTE: consider resizing
          cpu: 512,
          memoryMiB: 1024,
          name: 'redshift',
          imageTarballPath: getDockerImagePath(Connectors.getDockerImageName('REDSHIFT')),
        });

        this.amazonRedshiftECSCluster.taskDefinition.taskRole.addToPrincipalPolicy(
          ExternalSourceRedshiftAccessPolicyStatement,
        );

        addCfnNagSuppressionsToRolePolicy(this.amazonRedshiftECSCluster.taskDefinition.taskRole,
          [{
            id: 'W76',
            reason: 'SPCM expected to be high for ECS Task execution role',
          },
          ]);

        this.lastUpdatedDetailTable.grantReadWriteData(this.amazonRedshiftECSCluster.taskDefinition.taskRole);

        this.amazonRedshiftImportDataStateMachine = new ImportDataStateMachine(this, 'RedshiftDataImportStateMachine', {
          cluster: this.amazonRedshiftECSCluster.cluster,
          taskDefinition: this.amazonRedshiftECSCluster.taskDefinition,
          containerDefinition: this.amazonRedshiftECSCluster.containerDefinition,
          securityGroup: this.ingressContainerInfra.dataIngressVPC.ecsSecurityGroup,
          vpc: this.ingressContainerInfra.dataIngressVPC.vpc,
        });

        ////////////////////////////////////////////
        // STATIC PARAMETERS - connector specific parameters stored in SSM availble in dynamic infra
        ////////////////////////////////////////////
        this.staticInfraParameterValue.redshiftConnector = {
          importDataStateMachineArn: this.amazonRedshiftImportDataStateMachine.stateMachine.stateMachineArn,
          lastUpdatedDetailTableName: this.lastUpdatedDetailTable.tableName,
          otherArns: {
            ecsTaskRole: this.amazonRedshiftECSCluster.taskDefinition.taskRole.roleArn,
          },
        };
      }
    };
  },
  staticInfraRefs: (constructor) => {
    return class StaticInfrastructureReferences extends constructor implements Connectors.Infra.IRefsFor<typeof ID> {
      public override readonly staticInfrastructureReferences: InstanceType<
        typeof constructor
      >['staticInfrastructureReferences'] &
        Connectors.Infra.RefsFor<typeof ID>;

      constructor(scope: Construct, id: string, props: StaticInfra.Refs.IConstructProps) {
        super(scope, id, props);

        ////////////////////////////////////////////
        // STATIC REFS - dereference all SSM parameter values above to infra references
        ////////////////////////////////////////////
        this.staticInfrastructureReferences.redshiftConnector = {
          importDataStateMachine: StateMachine.fromStateMachineArn(
            this,
            'amazonRedshiftImportDataStateMachine',
            props.staticInfrastructure.redshiftConnector.importDataStateMachineArn,
          ),
          lastUpdatedDetailTableName: props.staticInfrastructure.redshiftConnector.lastUpdatedDetailTableName,
          otherConstructs: {
            ecsTaskRole: Role.fromRoleArn(
              this,
              'redshiftEcsTaskRole',
              props.staticInfrastructure.redshiftConnector.otherArns!.ecsTaskRole,
            ),
          },
        };
      }
    };
  },
};
