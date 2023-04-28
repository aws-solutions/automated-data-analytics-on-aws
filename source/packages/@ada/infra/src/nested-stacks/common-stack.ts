/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  AccountPrincipal,
  CompositePrincipal,
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket } from '../common/constructs/s3/bucket';
import { BucketEncryption, CfnBucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { CountedTable } from '../common/constructs/dynamodb/counted-table';
import { CounterTable } from '../common/constructs/dynamodb/counter-table';
import { EntityManagementTables } from '../services/api/components/entity/constructs/entity-management-tables';
import { ExtendedNestedStack, addCfnNagSuppressionsToRolePolicy } from '@ada/cdk-core';
import {
  ExternalSourceDataKmsAccessPolicyStatement,
  ExternalSourceDataS3AccessPolicyStatement,
} from '@ada/infra-common';
import { InternalTokenKey } from '../common/constructs/kms/internal-token-key';
import { NestedStackProps } from 'aws-cdk-lib';

export type CommonStackProps = NestedStackProps;

/**
 * Common stack
 */
export class CommonStack extends ExtendedNestedStack {
  public readonly executeAthenaQueryLambdaRoleArn: string;
  public readonly cachedQueryTable: Table;
  public readonly counterTable: CounterTable;
  public readonly internalTokenKey: InternalTokenKey;
  public readonly entityManagementTables: EntityManagementTables;
  public readonly athenaOutputBucket: Bucket;
  public readonly accessLogsBucket: Bucket;

  constructor(scope: Construct, id: string, props: CommonStackProps) {
    super(scope, id, props);

    this.accessLogsBucket = new Bucket(this, 'AccessLogBucket', {
      // SSE-S3 is the only supported default bucket encryption for Server Access Logging target buckets
      encryption: BucketEncryption.S3_MANAGED,
      // Enable ACL so that CloudFront Distribution can drop logs into the bucket
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
    });
    (this.accessLogsBucket.node.defaultChild as CfnBucket).cfnOptions.metadata = {
      cfn_nag: {
        rules_to_suppress: [
          {
            id: 'W35',
            reason: 'No need to enable access logs on the access log bucket!',
          },
        ],
      },
    };

    const executeAthenaQueryLambdaRole = new Role(this, 'ExecuteAthenaQueryLambdaRole', {
      assumedBy: new CompositePrincipal(
        new AccountPrincipal(this.account),
        new ServicePrincipal('lambda.amazonaws.com'),
      ),
      description: 'Role created by data product service to be assumed by athena query executor Lambda',
    });
    // Include tagging in the trust policy
    executeAthenaQueryLambdaRole.assumeRolePolicy!.addStatements(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sts:TagSession'],
        principals: [new AccountPrincipal(this.account)],
      }),
    );

    // Grant access to external data sources
    executeAthenaQueryLambdaRole.addToPrincipalPolicy(ExternalSourceDataS3AccessPolicyStatement);
    executeAthenaQueryLambdaRole.addToPrincipalPolicy(ExternalSourceDataKmsAccessPolicyStatement);
    addCfnNagSuppressionsToRolePolicy(executeAthenaQueryLambdaRole, [
      {
        id: 'W12',
        reason:
          'Read access to all S3 buckets granted since dynamic grants limit number of data products significantly',
      },
    ]);

    this.athenaOutputBucket = new Bucket(this, 'AthenaOutputBucket', {
      versioned: true,
      serverAccessLogsBucket: this.accessLogsBucket,
      serverAccessLogsPrefix: 'athena-output-logs/',
    });
    this.athenaOutputBucket.grantReadWrite(executeAthenaQueryLambdaRole);

    this.executeAthenaQueryLambdaRoleArn = executeAthenaQueryLambdaRole.roleArn;

    this.counterTable = new CounterTable(this, 'CounterTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'tableName',
        type: AttributeType.STRING,
      },
    });

    this.cachedQueryTable = new CountedTable(this, 'CachedQueryTable', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'cacheId',
        type: AttributeType.STRING,
      },
      counterTable: this.counterTable,
    });

    this.internalTokenKey = new InternalTokenKey(this, 'InternalToken', {
      keyAlias: 'internal-token',
      secretName: 'sign-internal-token',
    });

    this.entityManagementTables = new EntityManagementTables(this, 'EntityManagementTables');
  }
}

export default CommonStack;
