/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { TransformJob } from '@ada/microservice-common';
import { handler } from '../prepare-next-transform';

describe('prepare-next-transform', () => {
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

  const prepareNextTransform = async (transformJobIndex: number, transformJobs: TransformJob[], tableNames: string[]) =>
    handler(
      {
        Payload: {
          databaseName: 'dbName',
          tableDetails: tableNames.map((tableName, i) => ({
            tableName: `${tableName}-suffix-${i}`,
            tableNameSuffix: `-suffix-${i}`,
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
          })),
          tablePrefix: 'some-prefix',
          transformJobs,
          transformJobCount: transformJobs.length,
          transformJobIndex,
          dataProduct: {
            updateTrigger: {
              triggerType: 'SCHEDULE',
              updatePolicy: 'REPLACE',
            },
          },
          ingestionTimestamp: '1670629751900',
        },
      },
      null,
    );

  it('should prepare the next transform when there are remaining transforms', async () => {
    const result = await prepareNextTransform(
      0,
      [makeTransform('automatic-1', ['json']), makeTransform('custom-1'), makeTransform('custom-2')],
      ['tableName'],
    );

    expect(result.transformJobIndex).toBe(1);
    expect(result.transformJobCount).toBe(3);
    expect(result.currentTransformJob).toEqual(makeTransform('custom-1'));
    expect(result.tablePrefix).toEqual(makeTransform('custom-1').outputCrawlerTablePrefix);
    expect(result.currentResolvedTransformJobs).toEqual([
      {
        ...makeTransform('custom-1'),
        inputTableName: 'tableName-suffix-0',
        outputS3TargetPath: 's3://bucket/key/-suffix-0/',
        tempS3Path: 's3://bucket/temp/-suffix-0/',
      },
    ]);
  });

  it('should prepare the next transforms for multiple tables', async () => {
    const result = await prepareNextTransform(
      0,
      [makeTransform('automatic-1', ['json']), makeTransform('custom-1'), makeTransform('custom-2')],
      ['table1', 'table2'],
    );

    expect(result.transformJobIndex).toBe(1);
    expect(result.transformJobCount).toBe(3);
    expect(result.currentTransformJob).toEqual(makeTransform('custom-1'));
    expect(result.tablePrefix).toEqual(makeTransform('custom-1').outputCrawlerTablePrefix);
    expect(result.currentResolvedTransformJobs).toEqual([
      {
        ...makeTransform('custom-1'),
        inputTableName: 'table1-suffix-0',
        outputS3TargetPath: 's3://bucket/key/-suffix-0/',
        tempS3Path: 's3://bucket/temp/-suffix-0/',
      },
      {
        ...makeTransform('custom-1'),
        inputTableName: 'table2-suffix-1',
        outputS3TargetPath: 's3://bucket/key/-suffix-1/',
        tempS3Path: 's3://bucket/temp/-suffix-1/',
      },
    ]);
  });

  it('should prepare the next transform when there are no remaining transforms', async () => {
    const result = await prepareNextTransform(
      2,
      [makeTransform('automatic-1', ['json']), makeTransform('custom-1'), makeTransform('custom-2')],
      ['tableName'],
    );

    expect(result.transformJobIndex).toBe(3);
    expect(result.transformJobCount).toBe(3);
    expect(result.currentTransformJob).toBeUndefined();
    expect(result.currentResolvedTransformJobs).toEqual([]);
    expect(result.tablePrefix).toBeUndefined();
  });
});
