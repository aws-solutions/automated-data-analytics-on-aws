/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { LOCK_PARTITION_KEY } from '../locks/constants';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import Table from '../../../../../common/constructs/dynamodb/table';

export class EntityManagementTables extends Construct {
  private readonly lockTable: Table;
  private readonly relationshipTable: Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.lockTable = new Table(this, 'Locks', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: LOCK_PARTITION_KEY,
        type: AttributeType.STRING,
      },
    });

    this.relationshipTable = new Table(this, 'Relationships', {
      pointInTimeRecovery: true,
      partitionKey: {
        name: 'left',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'right',
        type: AttributeType.STRING,
      },
    });
  }

  public configureLambdaForEntityManagement(lambda: LambdaFunction): void {
    this.lockTable.grantReadWriteData(lambda);
    this.relationshipTable.grantReadWriteData(lambda);
    lambda.addEnvironment('LOCK_TABLE_NAME', this.lockTable.tableName);
    lambda.addEnvironment('RELATIONSHIP_TABLE_NAME', this.relationshipTable.tableName);
  }
}
