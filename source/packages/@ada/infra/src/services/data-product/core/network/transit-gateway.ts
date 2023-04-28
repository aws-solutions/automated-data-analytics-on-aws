/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  CfnRoute,
  CfnTransitGateway,
  CfnTransitGatewayAttachment,
  CfnTransitGatewayRouteTable,
  CfnTransitGatewayRouteTableAssociation,
  CfnTransitGatewayRouteTablePropagation,
  SubnetType,
} from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { SolutionContext, tryGetSolutionContext } from '../../../../common/context';
import DataIngressVPC from './vpc';

// Data Ingress Network use Transit Gateway to connecto Ada DataIngressVPC with external VPCs so that
// the data sources reside in the customer's VPC can be safely accessed by Ada without leaving the VPC.
// Multiple data source VPCs can be connecto to the Data Ingress Network in the same time, and isolated
// between each other. Every data source VPC can only be accessed from Ada Data Ingress VPC.
// However, the CIDR of each data source VPC and Ada Data Ingress VPC can't be overlapped.
// The transit gateway setup is basically follow "Isolated VPcs with shared services" from AWS documentation
// with alternative and Ada stays as "shared services". Refer to the link below:
// https://docs.aws.amazon.com/vpc/latest/tgw/transit-gateway-isolated-shared.html

export interface DataIngressGatewayProps {
  dataIngressVPC: DataIngressVPC;
}

export class DataIngressGateway extends Construct {
  private readonly vpc: DataIngressVPC;
  private readonly transitGateway: CfnTransitGateway;
  private readonly dataSourceVPCAttachmentRouteTable: CfnTransitGatewayRouteTable;
  private readonly dataIngressVPCAttachmentRouteTable: CfnTransitGatewayRouteTable;

  // public properties for CfnOutput in main stack
  public readonly dataIngressNetworkCidr: string;
  public readonly dataIngressVPCCidr: string;
  public readonly transiteGatewayId: string;
  public readonly dataSourceVPCAttachmentRouteTableId: string;
  public readonly dataSourceVPCAttachmentPropogationRouteTableId: string;

  constructor(scope: Construct, id: string, props: DataIngressGatewayProps) {
    super(scope, id);

    const vpc = props.dataIngressVPC.vpc;
    this.dataIngressNetworkCidr = tryGetSolutionContext(this, SolutionContext.DATA_INGRESS_NETWORK_CIDR);
    this.dataIngressVPCCidr = vpc.vpcCidrBlock;

    // create transit gateway
    this.transitGateway = new CfnTransitGateway(this, 'DataIngressTransitGateway', {
      description: 'Ada Transit Gateway for data ingress connector VPC connectivity',
      transitGatewayCidrBlocks: [this.dataIngressNetworkCidr],
      dnsSupport: 'enable',
      defaultRouteTableAssociation: 'disable',
      defaultRouteTablePropagation: 'disable',
      autoAcceptSharedAttachments: 'disable',
      tags: [
        {
          key: 'Name',
          value: 'Ada Data Ingress Transit Gateway',
        },
      ],
    });
    this.transiteGatewayId = this.transitGateway.attrId;

    // create a route table for all ingress attachments
    // This route table linked with all data source attachment, and dataIngressVPC route is propogate into this route table.
    this.dataSourceVPCAttachmentRouteTable = new CfnTransitGatewayRouteTable(
      this,
      'DataSourceVPCAttachmentRouteTable',
      {
        transitGatewayId: this.transitGateway.attrId,
        tags: [
          {
            key: 'Name',
            value: 'Ada Data Source Attachment Associate',
          },
        ],
      },
    );
    this.dataSourceVPCAttachmentRouteTableId = this.dataSourceVPCAttachmentRouteTable.ref;

    // create a route table for data ingress VPC
    // this route table linked with DataIngressVPC and all data source VPC attachment route is propogate into this route table
    this.dataIngressVPCAttachmentRouteTable = new CfnTransitGatewayRouteTable(
      this,
      'DataIngressVPCAttachmentRouteTable',
      {
        transitGatewayId: this.transitGateway.attrId,
        tags: [
          {
            key: 'Name',
            value: 'Ada Data Source Attachment Propogate',
          },
        ],
      },
    );
    this.dataSourceVPCAttachmentPropogationRouteTableId = this.dataIngressVPCAttachmentRouteTable.ref;

    // attach Ada Data Ingress VPC to the transit gateway
    const dataIngressVPCAttachment = new CfnTransitGatewayAttachment(this, 'DataIngressVPCAttachment', {
      transitGatewayId: this.transitGateway.attrId,
      vpcId: vpc.vpcId,
      subnetIds: vpc.selectSubnets({ subnetType: SubnetType.PRIVATE_WITH_EGRESS }).subnetIds,
      options: {
        ApplianceModeSupport: 'disable',
        DnsSupport: 'enable',
        Ipv6Support: 'disable',
      },
      tags: [
        {
          key: 'Name',
          value: 'Ada Data Ingress VPC Attachment',
        },
      ],
    });

    // associate with the DataIngressVPC Route table
    new CfnTransitGatewayRouteTableAssociation(this, 'DataIngressVPCAssociation', {
      transitGatewayAttachmentId: dataIngressVPCAttachment.attrId,
      transitGatewayRouteTableId: this.dataSourceVPCAttachmentPropogationRouteTableId,
    });

    // enable route proporgation to the dataSourceVPCAttachmentRouteTable
    new CfnTransitGatewayRouteTablePropagation(this, 'DataIngressVPCPropogation', {
      transitGatewayAttachmentId: dataIngressVPCAttachment.attrId,
      transitGatewayRouteTableId: this.dataSourceVPCAttachmentRouteTableId,
    });

    // Add routes in Ada Data Ingress VPC for transit gateway
    // this will be the second route after local route to send
    // all traffic to the ingress network to transit gateway
    for (const subnet of vpc.privateSubnets) {
      const route = new CfnRoute(this, `TransitGatewayRoute-${subnet.node.id}`, {
        routeTableId: subnet.routeTable.routeTableId,
        destinationCidrBlock: this.dataIngressNetworkCidr,
        transitGatewayId: this.transitGateway.attrId,
      });
      route.addDependency(dataIngressVPCAttachment);
    }
  }
}

export default DataIngressGateway;
