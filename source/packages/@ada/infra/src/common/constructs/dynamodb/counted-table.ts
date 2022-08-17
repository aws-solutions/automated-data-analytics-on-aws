/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { CounterTable } from './counter-table';
import { DynamoDBConverterMarshall } from '@ada/aws-sdk';
import { TableProps } from 'aws-cdk-lib/aws-dynamodb';
import { get4DigitsHash } from '@ada/cdk-core';
import Table from './table';

export interface CountedTableProps extends Omit<TableProps, 'tableName'> {
  counterTable: CounterTable;
}

export class CountedTable extends Table {
  constructor(scope: Construct, id: string, props: CountedTableProps) {
    super(scope, id, props);

    const cr = new AwsCustomResource(this, 'CounterInitialization', {
      onCreate: {
        service: 'DynamoDB',
        action: 'putItem',
        parameters: {
          TableName: props.counterTable.tableName,
          Item: DynamoDBConverterMarshall({
            tableName: this.tableName,
            count: 0,
          }),
        },
        // ensures the initialisation occurs everytime a counter table is created
        physicalResourceId: PhysicalResourceId.of(`${id}-${get4DigitsHash(this.node.path, id)}`),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({ resources: [props.counterTable.tableArn] }),
    });

    props.counterTable.encryptionKey?.grantEncryptDecrypt(cr);
  }
}
