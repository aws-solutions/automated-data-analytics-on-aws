/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CrawledTableDetail, TransformJob } from '@ada/microservice-common';
import { handler } from '../prepare-transform-chain';

describe('prepare-transform-chain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const makeTransform = (scriptId: string, applicableClassifications?: string[]): TransformJob => ({
    scriptId,
    namespace: 'test',
    glueJobName: `${scriptId}-job`,
    outputS3Target: { bucket: 'bucket', key: 'key' },
    outputS3TargetPath: 's3://bucket/key/',
    tempS3Path: 's3://bucket/temp/',
    outputCrawlerName: `${scriptId}-crawler`,
    outputCrawlerTablePrefix: `${scriptId}-prefix`,
    applicableClassifications,
  });

  const makeTableDetails = (overrides: Partial<CrawledTableDetail>) => ({
    tableName: `discovered-table-suffix`,
    tableNameSuffix: `-suffix`,
    identifiers: {
      catalog: 'AwsDataCatalog',
      database: 'db',
      table: 'discovered-table',
    },
    location: 'test-location',
    compressed: false,
    classification: 'json',
    recordCount: 7,
    averageRecordSize: 7,
    columns: [],
    ...overrides,
  });

  const prepareTransformChain = async (classifications: string[], transformJobs: TransformJob[]) =>
    handler(
      {
        Payload: {
          databaseName: 'dbName',
          tableDetails: classifications.map((classification, i) =>
            makeTableDetails({
              tableName: `discovered-table-suffix-${i}`,
              tableNameSuffix: `-suffix-${i}`,
              classification,
            }),
          ),
          tablePrefix: 'some-prefix',
          transformJobs,
          dataProduct: {
            updateTrigger: {
              triggerType: 'SCHEDULE',
              updatePolicy: 'APPEND',
            },
          },
          ingestionTimestamp: '1670629751900',
        },
      },
      null,
    );

  it('should include automatic transforms for the given classification', async () => {
    expect(
      (
        await prepareTransformChain(
          ['json'],
          [
            makeTransform('automatic-1', ['json']),
            makeTransform('automatic-2', ['csv']),
            makeTransform('automatic-3', ['json', 'csv']),
            makeTransform('custom-1'),
            makeTransform('custom-2'),
          ],
        )
      ).transformJobs,
    ).toEqual([
      makeTransform('automatic-1', ['json']),
      makeTransform('automatic-3', ['json', 'csv']),
      makeTransform('custom-1'),
      makeTransform('custom-2'),
    ]);
  });

  it('should set the current transform', async () => {
    const result = await prepareTransformChain(
      ['json'],
      [makeTransform('automatic-1', ['json']), makeTransform('custom-1'), makeTransform('custom-2')],
    );

    expect(result.currentTransformJob).toEqual(makeTransform('automatic-1', ['json']));
    expect(result.currentResolvedTransformJobs).toEqual([
      {
        ...makeTransform('automatic-1', ['json']),
        inputTableName: 'discovered-table-suffix-0',
        outputS3TargetPath: 's3://bucket/key/-suffix-0/',
        tempS3Path: 's3://bucket/temp/-suffix-0/',
      },
    ]);
    expect(result.transformJobIndex).toBe(0);
    expect(result.transformJobCount).toBe(3);
  });

  it('should handle an empty list of transforms', async () => {
    const result = await prepareTransformChain(['json'], []);

    expect(result.currentTransformJob).toBeUndefined();
    expect(result.currentResolvedTransformJobs).toEqual([]);
    expect(result.transformJobIndex).toBe(0);
    expect(result.transformJobCount).toBe(0);
  });

  it('should throw an error if there are multiple tables with different classifications', async () => {
    await expect(
      async () => await prepareTransformChain(['json', 'csv'], [makeTransform('custom-1')]),
    ).rejects.toThrow();
  });

  it('should allow for multiple tables with the same classification', async () => {
    const result = await prepareTransformChain(
      ['json', 'json'],
      [makeTransform('automatic-1', ['json']), makeTransform('custom-1')],
    );
    expect(result.transformJobs).toEqual([makeTransform('automatic-1', ['json']), makeTransform('custom-1')]);
    expect(result.currentResolvedTransformJobs).toEqual([
      {
        ...makeTransform('automatic-1', ['json']),
        inputTableName: 'discovered-table-suffix-0',
        outputS3TargetPath: 's3://bucket/key/-suffix-0/',
        tempS3Path: 's3://bucket/temp/-suffix-0/',
      },
      {
        ...makeTransform('automatic-1', ['json']),
        inputTableName: 'discovered-table-suffix-1',
        outputS3TargetPath: 's3://bucket/key/-suffix-1/',
        tempS3Path: 's3://bucket/temp/-suffix-1/',
      },
    ]);
  });
});
