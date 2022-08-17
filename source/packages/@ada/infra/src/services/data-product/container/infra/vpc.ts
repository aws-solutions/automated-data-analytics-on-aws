/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CfnResource } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { FlowLog, FlowLogDestination, FlowLogResourceType, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { LogGroup } from '../../../../common/constructs/cloudwatch/log-group';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { SolutionContext, tryGetSolutionContext } from '../../../../common/context';
import { addCfnNagSuppressions } from '@ada/cdk-core';

export class ECSVpcConstructStack extends Construct {
  public readonly vpc: Vpc;
  public readonly securityGroup: SecurityGroup;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.vpc = new Vpc(this, 'Vpc', {
      cidr: tryGetSolutionContext(this, SolutionContext.VPC_CIDR) || '192.168.0.0/16', //NOSONAR (S1313) - Harded coded IP is CIDR range
      maxAzs: 2,
      subnetConfiguration: [
        {
          subnetType: SubnetType.PUBLIC,
          name: 'ECSPublicsubnetForNatGateway',
        },
        {
          subnetType: SubnetType.PRIVATE_WITH_NAT,
          name: 'ECSPrivateWithNat',
        },
      ],
    });
    this.vpc.node.children
      .filter((child) => child.node.tryFindChild('Subnet'))
      .forEach((subnet) =>
        addCfnNagSuppressions(subnet.node.findChild('Subnet') as CfnResource, [
          {
            id: 'W33',
            reason: 'MapPublicIpOnLaunch required for public subnet',
          },
        ]),
      );

    this.securityGroup = new SecurityGroup(this, 'ECSSecurityGroup', {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: 'Security group used by the ECS container',
    });
    addCfnNagSuppressions(this.securityGroup.node.defaultChild as CfnResource, [
      {
        id: 'W5',
        reason:
          'All egress traffic permitted for full internet access for communication with dependent services, eg GCP',
      },
      {
        id: 'W40',
        reason:
          'All egress traffic permitted for full internet access for communication with dependent services, eg GCP',
      },
    ]);

    const logGroup = new LogGroup(this, 'VPCLogs');
    const role = new Role(this, 'ECSVPCLogsRole', {
      assumedBy: new ServicePrincipal('vpc-flow-logs.amazonaws.com'),
    });

    new FlowLog(this, 'VPCFlowLogs', {
      resourceType: FlowLogResourceType.fromVpc(this.vpc),
      destination: FlowLogDestination.toCloudWatchLogs(logGroup, role),
    });
  }
}

export default ECSVpcConstructStack;
