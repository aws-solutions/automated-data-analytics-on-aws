/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  DATA_PRODUCT_APPEND_DATA_PARTITION_KEY,
  DataProductUpdateTriggerType,
  DataSetIds,
  SourceUpdatePolicy,
} from '@ada/common';
import { Connectors } from '@ada/connectors';
import { DEFAULT_S3_SOURCE_DATA_PRODUCT } from '@ada/microservice-test-common';
import { handler } from '../prepare-external-import';

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

describe('prepare-external-imports', () => {
  const now = '2021-01-01T00:00:00.000Z';

  beforeEach(async () => {
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  const prepareGoogleAnalyticsImports = (triggerType: DataProductUpdateTriggerType, updatePolicy: SourceUpdatePolicy) =>
    handler(
      {
        Payload: {
          crawlerName: 'test-crawler',
          dataProduct: {
            ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
            sourceType: Connectors.Id.GOOGLE_ANALYTICS,
            sourceDetails: {
              viewId: '12345678',
              since: '',
              until: '',
              dimensions: 'ga:country,ga:users',
              metrics: 'ga:sessions',
            },
            updateTrigger: {
              triggerType,
              updatePolicy,
            },
          },
          tablePrefix: 'table-prefix-',
          outputS3Path: 's3://output/path',
        },
      },
      null,
    );

  it('should prepare ga import for a scheduled append update type', async () => {
    const result = await prepareGoogleAnalyticsImports(DataProductUpdateTriggerType.SCHEDULE, 'APPEND');
    expect(result.tablePrefix).toBe('table-prefix-');
    expect(result.outputS3Path).toBe(
      `s3://output/path/${DataSetIds.DEFAULT}/${DATA_PRODUCT_APPEND_DATA_PARTITION_KEY}=${Date.now()}`,
    );
    // TODO: drop old table
    // expect(result.dropTableQueries).toEqual([{ query: `DROP TABLE \`database\`.\`ctas-table-prefix-${Date.now()}\`` }]);
  });

  it('should prepare ga import for a scheduled replace update type', async () => {
    mockGetTables.mockReturnValue({
      TableList: [{ Name: 'old-table-1' }, { Name: 'old-table-2' }],
    });
    const result = await prepareGoogleAnalyticsImports(DataProductUpdateTriggerType.SCHEDULE, 'REPLACE');

    expect(result.tablePrefix).toBe(`table-prefix-${Date.now()}`);
    expect(result.outputS3Path).toBe(`s3://output/path/${Date.now()}/${DataSetIds.DEFAULT}/`);
  });

  it('should prepare ga import for an on-demand replace update type', async () => {
    mockGetTables.mockReturnValue({
      TableList: [{ Name: 'old-table-1' }, { Name: 'old-table-2' }],
    });
    const result = await prepareGoogleAnalyticsImports(DataProductUpdateTriggerType.ON_DEMAND, 'REPLACE');

    expect(result.tablePrefix).toBe(`table-prefix-${Date.now()}`);
    expect(result.outputS3Path).toBe(`s3://output/path/${Date.now()}/${DataSetIds.DEFAULT}/`);
  });

  it('should support ga import for an on-demand append update type', async () => {
    mockGetTables.mockReturnValue({
      TableList: [{ Name: 'old-table-1' }, { Name: 'old-table-2' }],
    });
    const result = await prepareGoogleAnalyticsImports(DataProductUpdateTriggerType.ON_DEMAND, 'APPEND');

    expect(result.tablePrefix).toBe(`table-prefix-`);
    expect(result.outputS3Path).toBe(`s3://output/path/${DataSetIds.DEFAULT}/ada_____partition=${Date.now()}`);
  });
});
