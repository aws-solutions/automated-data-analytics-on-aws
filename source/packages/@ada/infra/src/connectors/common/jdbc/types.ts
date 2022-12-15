/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

/**
 * Interface for the "sourceDetails" of data products of the JDBC connector
 * @required
 */

export interface ISourceDetails__JDBC {
  databaseEndpoint: string;
  databasePort: string;
  databaseSchema: string;
  databaseTable: string;
  databaseName: string;
  username: string;
  password: string;
  dbCredentialSecretName?: string;
}
