/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { BillingMode, Table as DynamoTable, TableEncryption, TableProps } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { ENV_TEST } from '../../env';
import { RemovalPolicy } from 'aws-cdk-lib';
import KMSStack from '../../../nested-stacks/kms-stack';
import type { Mutable } from '../../../../../../../@types/ts-utils';
interface ExtendedTableProps extends Omit<TableProps, 'encryption' | 'tableName' | 'removalPolicy'> {
  readonly encryption?: TableProps['encryption'] | null;
  /**
   * Indicates if table is retained when solution is deleted.
   *
   * If `true`, sets the tables `removalPolicy: RemovalPolicy.RETAIN` as well as
   * the encryption KmsKey `removalPolicy` to match if custom key is used.
   * @default false
   */
  readonly retain?: boolean;
}
export default class Table extends DynamoTable {
  constructor(scope: Construct, id: string, { encryption, encryptionKey, ...props }: ExtendedTableProps) {
    const { retain, ...tableProps } = props;

    if (ENV_TEST) {
      // force bucketName to id for testing deterministic value
      (props as Mutable<TableProps>).tableName = (props as Mutable<TableProps>).tableName || id;
    }

    if (encryption === null) {
      encryption = undefined;
    } else if (encryption === undefined && encryptionKey == null) {
      encryption = TableEncryption.CUSTOMER_MANAGED;
      encryptionKey = KMSStack.createKey(scope, `Table-${id}`, {
        description: `Key for DynamoDB table ${id}`,
        removalPolicy: retain ? RemovalPolicy.RETAIN : undefined,
      });
    }

    super(scope, id, {
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: retain ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      encryption,
      encryptionKey,
      pointInTimeRecovery: true,
      ...tableProps,
    });
  }
}
