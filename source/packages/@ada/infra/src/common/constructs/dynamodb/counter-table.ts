/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { TableEncryption, TableProps } from 'aws-cdk-lib/aws-dynamodb';
import Table from './table';

export const COUNTER_TABLE_NAME = 'COUNTER_TABLE_NAME';

export class CounterTable extends Table {
  constructor(scope: Construct, id: string, props: Omit<TableProps, 'tableName'>) {
    super(scope, id, { encryption: TableEncryption.AWS_MANAGED, ...props });
  }

  /**
   * Grants the necessary permissions and sets up the environment for a lambda to record pagination totals
   */
  public configureLambdaForPagination(lambda: LambdaFunction): void {
    this.grantReadWriteData(lambda);
    lambda.addEnvironment(COUNTER_TABLE_NAME, this.tableName);
  }
}
