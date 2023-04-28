/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { DataIngressECSCluster, DataIngressECSClusterProps } from './ecs-cluster';
import { DataProductSecretsPolicyStatement } from '../../../../common/constructs/iam/policies';
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { addCfnNagSuppressionsToRolePolicy } from '@ada/cdk-core';
import DataIngressVPC from '../../core/network/vpc';

export interface IngressContainerInfraProps {
  readonly dataIngressVpc: DataIngressVPC;
  readonly dataBucket: Bucket;
}

export class IngressContainerInfra extends Construct {
  private readonly dataBucket: Bucket;
  public readonly dataIngressVPC: DataIngressVPC;

  constructor(scope: Construct, id: string, props: IngressContainerInfraProps) {
    super(scope, id);

    this.dataBucket = props.dataBucket;
    this.dataIngressVPC = props.dataIngressVpc;
  }

  public createCluster(
    id: string,
    props: Omit<DataIngressECSClusterProps, 'vpc' | 'securityGroup' | 'taskDefinitionRole'>,
  ): DataIngressECSCluster {
    return new DataIngressECSCluster(this, id, {
      vpc: this.dataIngressVPC.vpc,
      securityGroup: this.dataIngressVPC.ecsSecurityGroup,
      taskDefinitionRole: this.createECSRole(`${id}Role`, this.dataBucket),
      ...props,
    });
  }

  private createECSRole(id: string, dataBucket: Bucket) {
    const role = new Role(this, id, {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    role.addToPolicy(
      new PolicyStatement({
        resources: [`${dataBucket.bucketArn}/*`, dataBucket.bucketArn],
        actions: [
          's3:AbortMultipartUpload',
          's3:GetBucketLocation',
          's3:GetObject',
          's3:ListBucket',
          's3:ListBucketMultipartUploads',
          's3:PutObject',
        ],
        effect: Effect.ALLOW,
      }),
    );

    role.addToPolicy(DataProductSecretsPolicyStatement);

    addCfnNagSuppressionsToRolePolicy(role, [
      {
        id: 'W12',
        reason: '* resource required to create log streams',
      },
    ]);

    if (dataBucket.encryptionKey) {
      role.addToPolicy(
        new PolicyStatement({
          actions: ['kms:GenerateDataKey', 'kms:Decrypt', 'kms:Encrypt'],
          effect: Effect.ALLOW,
          resources: [dataBucket.encryptionKey.keyArn],
        }),
      );
    }

    return role;
  }
}

export default IngressContainerInfra;
