/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { DynamicInfraStackProps } from '@ada/dynamic-infra/stacks/dynamic-infrastructure-stack-base';
import { ISourceDetails__JDBC } from '@ada/connectors/common/jdbc/types';
import { JDBCSourceStackBase } from '@ada/connectors/common/jdbc/base-stack';

/**
 * Stack for dynamic infrastructure for an s3 source'd data product
 */
export class MySql5SourceStack extends JDBCSourceStackBase {
  constructor(scope: Construct, id: string, props: DynamicInfraStackProps) {
    super(scope, id, props);
  }

  protected getConnectionString(sourceDetails: ISourceDetails__JDBC): string {
    const { databaseEndpoint, databasePort, databaseName } = sourceDetails;
    return `jdbc:mysql://${databaseEndpoint}:${databasePort}/${databaseName}`;
  }
}

export default MySql5SourceStack;
