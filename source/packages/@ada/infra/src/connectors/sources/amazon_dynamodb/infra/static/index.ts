/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Connectors } from '@ada/connectors/interface';
import { Construct } from 'constructs';
import { DataIngressECSCluster } from '@ada/services/data-product/container/infra/ecs-cluster';
import { ExternalSourceDynamoDBAccessPolicyStatement, getDockerImagePath } from '@ada/infra-common';
import { ID } from '../..';
import { Role } from 'aws-cdk-lib/aws-iam';
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
      amazonDynamoDBECSCluster: DataIngressECSCluster;
      readonly amazonDynamoDBImportDataStateMachine: ImportDataStateMachine;

      public override readonly staticInfraParameterValue: InstanceType<
        typeof constructor
      >['staticInfraParameterValue'] &
        Connectors.Infra.ParamsFor<typeof ID>;

      constructor(scope: Construct, id: string, props: StaticInfra.Stack.IConstructProps) {
        super(scope, id, props);

        ////////////////////////////////////////////
        // STATIC INFRA
        ////////////////////////////////////////////
        this.amazonDynamoDBECSCluster = this.ingressContainerInfra.createCluster('DynamoDB', {
          // NOTE: consider resizing
          cpu: 512,
          memoryMiB: 1024,
          name: 'dynamoDB',
          imageTarballPath: getDockerImagePath(Connectors.getDockerImageName('DYNAMODB')),
        });

        this.amazonDynamoDBECSCluster.taskDefinition.taskRole.addToPrincipalPolicy(
          ExternalSourceDynamoDBAccessPolicyStatement,
        );

        this.lastUpdatedDetailTable.grantReadWriteData(this.amazonDynamoDBECSCluster.taskDefinition.taskRole);

        this.amazonDynamoDBImportDataStateMachine = new ImportDataStateMachine(this, 'DynamoDBDataImportStateMachine', {
          cluster: this.amazonDynamoDBECSCluster.cluster,
          taskDefinition: this.amazonDynamoDBECSCluster.taskDefinition,
          containerDefinition: this.amazonDynamoDBECSCluster.containerDefinition,
          securityGroup: this.ingressContainerInfra.dataIngressVPC.ecsSecurityGroup,
          vpc: this.ingressContainerInfra.dataIngressVPC.vpc,
        });

        ////////////////////////////////////////////
        // STATIC PARAMETERS - connector specific parameters stored in SSM availble in dynamic infra
        ////////////////////////////////////////////
        this.staticInfraParameterValue.dynamoDBConnector = {
          importDataStateMachineArn: this.amazonDynamoDBImportDataStateMachine.stateMachine.stateMachineArn,
          lastUpdatedDetailTableName: this.lastUpdatedDetailTable.tableName,
          otherArns: {
            ecsTaskRole: this.amazonDynamoDBECSCluster.taskDefinition.taskRole.roleArn,
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
        this.staticInfrastructureReferences.dynamoDBConnector = {
          importDataStateMachine: StateMachine.fromStateMachineArn(
            this,
            'amazonDynamoDBImportDataStateMachine',
            props.staticInfrastructure.dynamoDBConnector.importDataStateMachineArn,
          ),
          lastUpdatedDetailTableName: props.staticInfrastructure.dynamoDBConnector.lastUpdatedDetailTableName,
          otherConstructs: {
            ecsTaskRole: Role.fromRoleArn(
              this,
              'ddbEcsTaskRole',
              props.staticInfrastructure.dynamoDBConnector.otherArns!.ecsTaskRole,
            ),
          },
        };
      }
    };
  },
};
