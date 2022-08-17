/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsGlueInstance, Glue } from '@ada/aws-sdk';
import { paginatedRequest } from '@ada/microservice-common';

/**
 * Class for interacting with Data Products in Glue
 */
export class GlueDataProduct {
  // Singleton instance of the glue data product
  private static instance: GlueDataProduct | undefined;

  /**
   * Get an instance of the glue data product. Creates the instance with any default dependencies.
   * @param dbName the database name
   * @returns and instance of the class
   */
  /* istanbul ignore next */
  public static getInstance = (dbName: string): GlueDataProduct =>
    GlueDataProduct.instance || new GlueDataProduct(dbName, AwsGlueInstance());

  private readonly glue: Glue;

  private readonly databaseName: string;

  /**
   * Create an instance of the glue data product
   * @param dbName the database name to instanciate the class for
   * @param glue the glue instance
   */
  private constructor(dbName: string, glue: Glue) {
    this.glue = glue;
    this.databaseName = dbName;
  }

  public getTablesStartingWith = (prefix: string): Promise<Glue.Types.Table[]> =>
    paginatedRequest<Glue.Types.GetTablesRequest>(
      this.glue.getTables.bind(this.glue),
      {
        DatabaseName: this.databaseName,
        Expression: `${prefix}*`,
      },
      'TableList',
      'NextToken',
    );
}
