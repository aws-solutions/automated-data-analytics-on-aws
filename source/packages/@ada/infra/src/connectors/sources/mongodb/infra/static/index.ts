/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Connectors } from '@ada/connectors/interface';
import { Construct } from 'constructs';
import { DataIngressECSCluster } from '@ada/services/data-product/container/infra/ecs-cluster';
import { ExternalSourceDataS3AccessPolicyStatement, getDockerImagePath } from '@ada/infra-common';
import { ID } from '../..';
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
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
      mongoDBECSCluster: DataIngressECSCluster;
      readonly mongoDBImportDataStateMachine: ImportDataStateMachine;

      public override readonly staticInfraParameterValue: InstanceType<
        typeof constructor
      >['staticInfraParameterValue'] &
        Connectors.Infra.ParamsFor<typeof ID>;

      constructor(scope: Construct, id: string, props: StaticInfra.Stack.IConstructProps) {
        super(scope, id, props);

        ////////////////////////////////////////////
        // STATIC INFRA
        ////////////////////////////////////////////
        this.mongoDBECSCluster = this.ingressContainerInfra.createCluster('MongoDB', {
          // NOTE: consider resizing
          cpu: 512,
          memoryMiB: 1024,
          name: 'mongoDB',
          imageTarballPath: getDockerImagePath(Connectors.getDockerImageName('MONGODB')),
        });

        this.mongoDBECSCluster.taskDefinition.taskRole.addToPrincipalPolicy(ExternalSourceDataS3AccessPolicyStatement);

        this.lastUpdatedDetailTable.grantReadWriteData(this.mongoDBECSCluster.taskDefinition.taskRole);

        this.mongoDBImportDataStateMachine = new ImportDataStateMachine(this, 'MongoDBImportDataStateMachine', {
          cluster: this.mongoDBECSCluster.cluster,
          taskDefinition: this.mongoDBECSCluster.taskDefinition,
          containerDefinition: this.mongoDBECSCluster.containerDefinition,
          securityGroup: this.ingressContainerInfra.dataIngressVPC.ecsSecurityGroup,
          vpc: this.ingressContainerInfra.dataIngressVPC.vpc,
        });

        ////////////////////////////////////////////
        // STATIC PARAMETERS - connector specific parameters stored in SSM availble in dynamic infra
        ////////////////////////////////////////////
        this.staticInfraParameterValue.mongoDBConnector = {
          importDataStateMachineArn: this.mongoDBImportDataStateMachine.stateMachine.stateMachineArn,
          lastUpdatedDetailTableName: this.lastUpdatedDetailTable.tableName,
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
        this.staticInfrastructureReferences.mongoDBConnector = {
          importDataStateMachine: StateMachine.fromStateMachineArn(
            this,
            'mongoDBImportDataStateMachine',
            props.staticInfrastructure.mongoDBConnector.importDataStateMachineArn,
          ),
          lastUpdatedDetailTableName: props.staticInfrastructure.mongoDBConnector.lastUpdatedDetailTableName,
        };
      }
    };
  },
};
