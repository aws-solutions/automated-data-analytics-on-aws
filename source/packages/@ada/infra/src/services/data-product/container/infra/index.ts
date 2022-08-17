/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ArnFormat, Stack } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { DATA_PRODUCT_SECRET_PREFIX } from '../../components/secrets-manager/data-product';
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { SecurityGroup, Vpc } from 'aws-cdk-lib/aws-ec2';
import { getDockerImagePath } from '@ada/infra-common';
import ECSContainerClusterStack from './ecs-cluster';
import ECSVpcConstructStack from './vpc';

export interface ContainerInfraStackProps {
  readonly dataBucket: Bucket;
}

export default class ContainerInfraStack extends Construct {
  public readonly googleStorageECSCluster: ECSContainerClusterStack;

  public readonly googleBigQueryECSCluster: ECSContainerClusterStack;

  public readonly googleAnalyticsECSCluster: ECSContainerClusterStack;

  public readonly ecsVpc: ECSVpcConstructStack;

  constructor(scope: Construct, id: string, props: ContainerInfraStackProps) {
    super(scope, id);

    const { dataBucket } = props;

    this.ecsVpc = new ECSVpcConstructStack(this, 'ContainersVpc');

    this.googleStorageECSCluster = this.createGoogleStorageECSCluster(
      this.ecsVpc.vpc,
      this.ecsVpc.securityGroup,
      dataBucket,
    );

    this.googleBigQueryECSCluster = this.createGoogleBigQueryECSCluster(
      this.ecsVpc.vpc,
      this.ecsVpc.securityGroup,
      dataBucket,
    );

    this.googleAnalyticsECSCluster = this.createGoogleAnalyticsECSCluster(
      this.ecsVpc.vpc,
      this.ecsVpc.securityGroup,
      dataBucket,
    );
  }

  private createGoogleStorageECSCluster(vpc: Vpc, securityGroup: SecurityGroup, dataBuket: Bucket) {
    return new ECSContainerClusterStack(this, 'GCPStorage', {
      vpc,
      securityGroup,
      // NOTE: consider resizing
      cpu: 512,
      memoryMiB: 1024,
      name: 'gcp-storage',
      taskDefinitionRole: this.createECSRole('GCPStorageRole', dataBuket),
      imageTarballPath: getDockerImagePath('google-storage-connector'),
    });
  }

  private createGoogleBigQueryECSCluster(vpc: Vpc, securityGroup: SecurityGroup, dataBuket: Bucket) {
    return new ECSContainerClusterStack(this, 'GCPBigQuery', {
      vpc,
      securityGroup,
      // NOTE: consider resizing
      cpu: 2048, // 2GB
      memoryMiB: 16384, // 16GB
      name: 'gcp-big-query',
      taskDefinitionRole: this.createECSRole('GCPBigQueryRole', dataBuket),
      imageTarballPath: getDockerImagePath('google-bigquery-connector'),
    });
  }

  private createGoogleAnalyticsECSCluster(vpc: Vpc, securityGroup: SecurityGroup, dataBuket: Bucket) {
    return new ECSContainerClusterStack(this, 'GoogleAnalytics', {
      vpc,
      securityGroup,
      // NOTE: consider resizing
      cpu: 2048, // 2GB
      memoryMiB: 16384, // 16GB
      name: 'google-analytics',
      taskDefinitionRole: this.createECSRole('GCPAnalyticsRole', dataBuket),
      imageTarballPath: getDockerImagePath('google-analytics-connector'),
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
    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['secretsManager:GetSecretValue'],
        resources: [
          Stack.of(this).formatArn({
            resource: 'secret',
            service: 'secretsmanager',
            resourceName: `${DATA_PRODUCT_SECRET_PREFIX}*`,
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
        ],
      }),
    );
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
