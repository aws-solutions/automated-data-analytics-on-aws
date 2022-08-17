/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CrawledTableDetail } from '@ada/microservice-common';
import { handler } from '../generate-pii-query';

describe('generate-pii-query', () => {
  const tableDetails = (name: string, suffix: string) =>
    ({
      tableName: name,
      tableNameSuffix: suffix,
      columns: [
        {
          name: 'col1',
          type: 'int',
        },
        {
          name: 'col2',
          type: 'string',
        },
        {
          name: 'col3',
          type: 'int',
        },
        {
          name: 'col4',
          type: 'string',
        },
      ],
    } as CrawledTableDetail);

  const tableDetailsIncompatibleColumns = (name: string, suffix: string) =>
    ({
      tableName: name,
      tableNameSuffix: suffix,
      columns: [
        {
          name: 'col1',
          type: 'int',
        },
        {
          name: 'col3',
          type: 'double',
        },
      ],
    } as CrawledTableDetail);

  it('should generate a pii query', async () => {
    const result = await handler(
      {
        Payload: {
          databaseName: 'dbName',
          tableDetails: [tableDetails('table1', 'suffix'), tableDetails('table2', 'suffix')],
          athenaUtilitiesLambdaName: 'AthenaLambdaName123',
        },
      },
      null,
    );

    const expectedRewrittenQuery = `USING EXTERNAL FUNCTION ada_detect_pii_types(col1 VARCHAR, lang VARCHAR) RETURNS VARCHAR LAMBDA 'AthenaLambdaName123' SELECT ada_detect_pii_types("col2",'en') as "col2", ada_detect_pii_types("col4",'en') as "col4" FROM "dbName"."table1" LIMIT 100;`;
    const expectedRewrittenQuery2 = `USING EXTERNAL FUNCTION ada_detect_pii_types(col1 VARCHAR, lang VARCHAR) RETURNS VARCHAR LAMBDA 'AthenaLambdaName123' SELECT ada_detect_pii_types("col2",'en') as "col2", ada_detect_pii_types("col4",'en') as "col4" FROM "dbName"."table2" LIMIT 100;`;

    expect(result.piiQuery[0].toString()).toBe(expectedRewrittenQuery);
    expect(result.piiQuery[1].toString()).toBe(expectedRewrittenQuery2);
  });
  it('should have empty query when all columns are incompatible for pii ', async () => {
    const result = await handler(
      {
        Payload: {
          databaseName: 'dbName',
          tableDetails: [tableDetailsIncompatibleColumns('dataProductIdtableName', 'tableName')],
          athenaUtilitiesLambdaName: 'AthenaLambdaName123',
        },
      },
      null,
    );

    expect(result.piiQuery[0].toString()).toBe('');
  });
});
