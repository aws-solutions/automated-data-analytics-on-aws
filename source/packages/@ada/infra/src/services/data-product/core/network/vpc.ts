/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Arn, CfnResource, Stack } from 'aws-cdk-lib';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import {
  FlowLog,
  FlowLogDestination,
  FlowLogResourceType,
  IpAddresses,
  SecurityGroup,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import { LogGroup } from '../../../../common/constructs/cloudwatch/log-group';
import { Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { SolutionContext, tryGetSolutionContext } from '../../../../common/context';
import { addCfnNagSuppressions } from '@ada/cdk-core';

export class DataIngressVPC extends Construct {
  public readonly vpc: Vpc;
  public readonly ecsSecurityGroup: SecurityGroup;
  public readonly previewSecurityGroup: SecurityGroup;
  public readonly glueConnectionSecurityGroup: SecurityGroup;
  public readonly glueJDBCTargetSecurityGroup: SecurityGroup;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.vpc = new Vpc(this, 'DataIngressVPC', {
      // VPC CIDR should have at least /24 mask
      ipAddresses: IpAddresses.cidr(tryGetSolutionContext(this, SolutionContext.DATA_INGRESS_VPC_CIDR)),

      // can't use more than 2 Azs for keep stack environment agonistic
      maxAzs: 2,

      enableDnsHostnames: true,
      enableDnsSupport: true,

      subnetConfiguration: [
        {
          subnetType: SubnetType.PUBLIC,
          name: 'DataIngressPublicsubnetForNatGateway',
        },
        {
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
          name: 'DataIngressPrivateWithNat',
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

    const supressReasons = [
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
    ];
    this.ecsSecurityGroup = new SecurityGroup(this, 'ECSSecurityGroup', {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: 'Security group used by the ECS container',
    });
    addCfnNagSuppressions(this.ecsSecurityGroup.node.defaultChild as CfnResource, supressReasons);

    this.previewSecurityGroup = new SecurityGroup(this, 'PreviewSecurityGroup', {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: 'Security group used by the Preview Lambda',
    });
    addCfnNagSuppressions(this.previewSecurityGroup.node.defaultChild as CfnResource, supressReasons);

    // Security group for glue connectors, if connect to JDBC target, must be used with glueJDBCSecurityGroup together
    this.glueConnectionSecurityGroup = new SecurityGroup(this, 'GlueConnectionSecurityGroup', {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: 'Security group used by the Glue Connections',
    });
    addCfnNagSuppressions(this.glueConnectionSecurityGroup.node.defaultChild as CfnResource, supressReasons);

    // Glue JDBC connection for Crawler requires a security group that allows all traffic inbound to work
    // to limit the access, the peer is set to itself so it is a self-referencing security group.
    // Glue actually check whether or not this security group before it start crawling from the data source.
    // the self-referncing entry can be created with CDK/CFN, so use AWSCustomResource instead.
    this.glueJDBCTargetSecurityGroup = new SecurityGroup(this, 'glueJDBCTargetSecurityGroup', {
      vpc: this.vpc,
      allowAllOutbound: true,
      description: 'Security group used by the Glue JDBC Connections',
    });

    const addSelfReferenceIngressRule = new AwsCustomResource(this, 'AddSelfReferenceIngress', {
      onCreate: {
        service: 'EC2',
        action: 'authorizeSecurityGroupIngress',
        parameters: {
          GroupId: this.glueJDBCTargetSecurityGroup.securityGroupId,
          IpPermissions: [
            {
              IpProtocol: '-1',
              UserIdGroupPairs: [
                {
                  Description: 'Glue JDBC Connection',
                  GroupId: this.glueJDBCTargetSecurityGroup.securityGroupId,
                },
              ],
            },
          ],
        },
        physicalResourceId: PhysicalResourceId.of(`${this.glueJDBCTargetSecurityGroup.securityGroupId}-rule`),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: [
          Arn.format(
            {
              service: 'ec2',
              resource: 'security-group',
              resourceName: this.glueJDBCTargetSecurityGroup.securityGroupId,
            },
            Stack.of(this),
          ),
        ],
      }),
    });
    addSelfReferenceIngressRule.node.addDependency(this.glueJDBCTargetSecurityGroup);
    addCfnNagSuppressions(this.glueJDBCTargetSecurityGroup.node.defaultChild as CfnResource, supressReasons);

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

export default DataIngressVPC;
