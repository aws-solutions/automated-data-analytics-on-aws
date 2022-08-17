/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { CrawledTableDetail } from '@ada/microservice-common';
import { PaginatedQueryResult } from '../../../../../../../../api/client';
import { QueryExecutionOutput, getMaxPiiType, handler } from '../get-pii-query-result';
import { getQueryResults } from '../../../../../../../src/services/query/components/athena';
import { mocked } from 'ts-jest/utils';

jest.mock('../../../../../../../src/services/query/components/athena', () => ({
  getQueryResults: jest.fn(),
}));

describe('get-pii-query-result', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const tableDetails = (name: string, suffix: string) =>
    ({
      tableName: name,
      tableNameSuffix: suffix,
      identifiers: {
        catalog: 'AwsDataCatalog',
        database: 'test-database',
        table: 'tableName',
      },
      columns: [
        {
          name: 'col1',
          type: 'string',
        },
        {
          name: 'col2',
          type: 'string',
        },
        {
          name: 'col3',
          type: 'int',
        },
      ],
      averageRecordSize: 123,
      classification: 'json',
      compressed: true,
      location: 's3://location',
      recordCount: 100,
      compressionType: 'none',
    } as CrawledTableDetail);

  const mockOutput: QueryExecutionOutput[] = [
    {
      Output: {
        queryExecutionId: '4ed67f34-d1f7-4dca-b2c7-1455a82834a1',
        athenaStatus: {
          QueryExecution: {
            QueryExecutionId: '4ed67f34-d1f7-4dca-b2c7-1455a82834a1',
            Status: {
              State: 'SUCCEEDED',
              StateChangeReason: 'Success running query.',
            },
          },
        },
      },
    },
  ];

  const mockOutputSkipPii: QueryExecutionOutput[] = [
    {
      piiDetectionSkipped: true,
    },
  ];

  const mockFailedOutput: QueryExecutionOutput[] = [
    {
      Output: {
        queryExecutionId: '4ed67f34-d1f7-4dca-b2c7-1455a82834a1',
        athenaStatus: {
          QueryExecution: {
            QueryExecutionId: '4ed67f34-d1f7-4dca-b2c7-1455a82834a1',
            Status: {
              State: 'FAILED',
              StateChangeReason: 'Athena permission error.',
            },
          },
        },
      },
    },
  ];

  it('should generate a pii column data', async () => {
    mocked(getQueryResults).mockResolvedValue({
      data: [
        {
          col1: 'ADDRESS',
          col2: 'NAME',
        },
        {
          col1: 'ADDRESS',
          col2: 'NAME',
        },
        {
          col1: 'NONE',
          col2: 'NAME',
        },
        {
          col1: 'ADDRESS',
          col2: 'NAME',
        },
      ],
      columns: [
        { name: 'col1', type: 'string' },
        { name: 'col2', type: 'string' },
      ],
    } as PaginatedQueryResult);

    const result = await handler(
      {
        Payload: {
          executePiiDetectionOutput: mockOutput,
          tableDetails: [tableDetails('table1', 'prefix')],
        },
      },
      null,
    );
    const expected = [
      {
        ...tableDetails('table1', 'prefix'),
        columns: [
          {
            name: 'col1',
            type: 'string',
            piiClassification: 'ADDRESS',
          },
          {
            name: 'col2',
            type: 'string',
            piiClassification: 'NAME',
          },
          {
            name: 'col3',
            type: 'int',
            piiClassification: undefined,
          },
        ],
      },
    ];

    expect(result).toStrictEqual(expected);
  });
  it('should keep original column data unaltered if query did not execute', async () => {
    mocked(getQueryResults).mockResolvedValue({
      data: [
        {
          col1: 'ADDRESS',
          col2: 'NAME',
        },
      ],
      columns: [
        { name: 'col1', type: 'string' },
        { name: 'col2', type: 'string' },
      ],
    } as PaginatedQueryResult);

    const result = await handler(
      {
        Payload: {
          executePiiDetectionOutput: mockFailedOutput,
          tableDetails: [tableDetails('table1', 'prefix')],
        },
      },
      null,
    );
    const expected = [tableDetails('table1', 'prefix')];

    expect(result).toStrictEqual(expected);
  });

  it('should keep original column data unaltered if pii detection is skipped', async () => {
    mocked(getQueryResults).mockResolvedValue({
      data: [
        {
          col1: 'ADDRESS',
          col2: 'NAME',
        },
      ],
      columns: [
        { name: 'col1', type: 'string' },
        { name: 'col2', type: 'string' },
      ],
    } as PaginatedQueryResult);

    const result = await handler(
      {
        Payload: {
          executePiiDetectionOutput: mockOutputSkipPii,
          tableDetails: [tableDetails('table1', 'prefix')],
        },
      },
      null,
    );
    const expected = [tableDetails('table1', 'prefix')];

    expect(result).toStrictEqual(expected);
  });

  it('getMaxPiiType should return max value and associated key', async () => {
    const map = new Map();
    map.set('A', 1);
    map.set('B', 10);
    const result = getMaxPiiType(map);

    expect(result).toBe('B');
  });

  it('getMaxPiiType should return 2nd highest value if exists & max detected type is NONE', async () => {
    const map = new Map();
    map.set('NONE', 100);

    let result = getMaxPiiType(map);
    expect(result).toBe('NONE');

    map.set('B', 10);
    result = getMaxPiiType(map);

    expect(result).toBe('B');
  });
});
