/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DATA_PRODUCT_APPEND_DATA_PARTITION_KEY, DataSetIds, SourceType, SourceUpdatePolicy } from '@ada/common';
import { DEFAULT_S3_SOURCE_DATA_PRODUCT } from '@ada/microservice-test-common';
import { handler } from '../prepare-ctas-query';

const mockUpdateCrawler = jest.fn();
const mockGetTables = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsGlueInstance: jest.fn().mockImplementation(() => ({
    updateCrawler: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockUpdateCrawler(...args))),
    }),
    getTables: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockGetTables(...args))),
    }),
  })),
}));

describe('prepare-ctas-query', () => {
  const now = '2021-01-01T00:00:00.000Z';

  beforeEach(async () => {
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  const prepareCtasQuery = (updateType: SourceUpdatePolicy | string) =>
    handler(
      {
        Payload: {
          crawlerName: 'test-crawler',
          dataProduct: {
            ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
            sourceType: SourceType.QUERY,
            sourceDetails: {
              query: 'select * from data.product',
              updateType,
            } as any, // TODO: QUERY source type is deprecated for MVP - so it's type is not included in SourceDetailsSchema
          },
          tablePrefix: 'table-prefix-',
          selectQuery: 'select * from governed.data.product',
          outputS3Path: 's3://output/path',
          database: 'database',
        },
      },
      null,
    );

  it('should prepare the ctas query for an append update type', async () => {
    const result = await prepareCtasQuery('APPEND');

    expect(result.tablePrefix).toBe('table-prefix-');
    expect(result.ctasTableName).toBe(`ctas-table-prefix-${Date.now()}`);

    expect(result.ctasQuery).toBe(`CREATE TABLE "database"."ctas-table-prefix-${Date.now()}"
WITH (
  external_location = 's3://output/path/${DataSetIds.DEFAULT}/${DATA_PRODUCT_APPEND_DATA_PARTITION_KEY}=${Date.now()}',
  format = 'PARQUET'
) AS (select * from governed.data.product)`);

    expect(result.dropTableQueries).toEqual([{ query: `DROP TABLE \`database\`.\`ctas-table-prefix-${Date.now()}\`` }]);
  });

  it('should prepare the ctas query for a replace update type', async () => {
    mockGetTables.mockReturnValue({
      TableList: [{ Name: 'old-table-1' }, { Name: 'old-table-2' }],
    });

    const result = await prepareCtasQuery('REPLACE');

    expect(result.tablePrefix).toBe(`table-prefix-${Date.now()}`);
    expect(result.ctasTableName).toBe(`ctas-table-prefix-${Date.now()}`);

    expect(result.ctasQuery).toBe(`CREATE TABLE "database"."ctas-table-prefix-${Date.now()}"
WITH (
  external_location = 's3://output/path/${Date.now()}/${DataSetIds.DEFAULT}',
  format = 'PARQUET'
) AS (select * from governed.data.product)`);

    expect(mockUpdateCrawler).toHaveBeenCalledWith({
      Name: 'test-crawler',
      Targets: {
        S3Targets: [
          {
            Path: `output/path/${Date.now()}/${DataSetIds.DEFAULT}`,
          },
        ],
      },
      TablePrefix: `table-prefix-${Date.now()}`,
    });

    expect(mockGetTables).toHaveBeenCalledWith({
      DatabaseName: 'database',
      Expression: 'table-prefix-*',
    });

    // We should drop any old tables we are replacing
    expect(result.dropTableQueries).toEqual([
      { query: `DROP TABLE \`database\`.\`ctas-table-prefix-${Date.now()}\`` },
      { query: 'DROP TABLE `database`.`old-table-1`' },
      { query: 'DROP TABLE `database`.`old-table-2`' },
    ]);
  });

  it('should throw an error if the ctas query receives an unsupported update type', async () => {
    await expect(prepareCtasQuery('UNSUPPORTED')).rejects.toThrowError('Unsupported update type UNSUPPORTED');
  });
});
