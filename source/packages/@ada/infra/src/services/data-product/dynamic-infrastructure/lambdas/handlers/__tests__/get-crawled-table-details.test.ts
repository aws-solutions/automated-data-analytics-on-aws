/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Glue } from 'aws-sdk';
import { UPDATE_TABLE_KEYS, handler } from '../get-crawled-table-details';
import { pick } from 'lodash';

const mockGetTables = jest.fn();
const mockDeletePartitionIndex = jest.fn();
const mockUpdateTable = jest.fn();

const CATALOG_ID = 'AwsDataCatalog';
const DATABASE_NAME = 'dbName';
const TABLE_PREFIX = 'prefix_';

jest.mock('@ada/aws-sdk', () => ({
  AwsGlueInstance: jest.fn().mockImplementation(() => ({
    getTables: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockGetTables(...args))),
    }),
    deletePartitionIndex: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDeletePartitionIndex(...args))),
    }),
    updateTable: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockUpdateTable(...args))),
    }),
  })),
}));

describe('get-crawled-table-data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockTable: Glue.Table = {
    Name: TABLE_PREFIX + 'table1',
    DatabaseName: DATABASE_NAME,
    CatalogId: CATALOG_ID,
    StorageDescriptor: {
      Columns: [
        { Name: 'col1', Type: 'int' },
        { Name: 'col2', Type: 'string' },
      ],
      Compressed: true,
      Location: 's3://test/path',
    },
    Parameters: {
      classification: 'json',
      recordCount: '100',
      averageRecordSize: '123',
      compressionType: 'none',
    },
  };

  const expectedTableDetails = (prefix: string, name: string, _table: Glue.Table = mockTable) => ({
    tableName: TABLE_PREFIX + name,
    tableNameSuffix: name.replace(prefix, ''),
    identifiers: {
      table: TABLE_PREFIX + name,
      catalog: CATALOG_ID,
      database: DATABASE_NAME,
    },
    columns: _table.StorageDescriptor!.Columns!.map(({ Name, Type }) => ({
      name: Name,
      type: Type,
    })),
    compressed: _table.StorageDescriptor!.Compressed,
    location: _table.StorageDescriptor!.Location,
    classification: _table.Parameters!.classification,
    recordCount: Number(_table.Parameters!.recordCount),
    averageRecordSize: Number(_table.Parameters!.averageRecordSize),
    compressionType: _table.Parameters!.compressionType,
  });

  it('should retrieve table data in case the response is correct', async () => {
    mockGetTables.mockReturnValue({
      TableList: [mockTable],
    });

    const result = await handler(
      {
        Payload: {
          tablePrefix: TABLE_PREFIX,
          databaseName: DATABASE_NAME,
        },
      },
      null,
    );

    expect(mockGetTables).toHaveBeenCalledWith({
      DatabaseName: DATABASE_NAME,
      Expression: `${TABLE_PREFIX}*`,
    });
    expect(result.tablePrefix).toBe(TABLE_PREFIX);
    expect(result.databaseName).toBe(DATABASE_NAME);
    expect(result.tableDetails).toEqual([expectedTableDetails(TABLE_PREFIX, 'table1')]);
    expect(mockUpdateTable).not.toHaveBeenCalled();
  });

  it('should follow pagination to find the matching table', async () => {
    mockGetTables
      .mockReturnValueOnce({
        TableList: [],
        NextToken: 'some-token',
      })
      .mockReturnValueOnce({
        TableList: [mockTable],
      });

    const result = await handler(
      {
        Payload: {
          tablePrefix: TABLE_PREFIX,
          databaseName: DATABASE_NAME,
        },
      },
      null,
    );

    expect(result.tablePrefix).toBe(TABLE_PREFIX);
    expect(result.databaseName).toBe(DATABASE_NAME);
    expect(result.tableDetails).toEqual([expectedTableDetails(TABLE_PREFIX, 'table1')]);
  });

  it('should remove glue partition keys if detected', async () => {
    mockGetTables.mockReturnValue({
      TableList: [
        {
          ...mockTable,
          Name: TABLE_PREFIX + 'table1',
          PartitionKeys: [{ Name: 'partition_0' }, { Name: 'partition_1' }],
        },
        {
          ...mockTable,
          Name: TABLE_PREFIX + 'table2',
          StorageDescriptor: {
            ...mockTable.StorageDescriptor,
            Columns: [
              ...(mockTable.StorageDescriptor?.Columns || []),
              { Name: 'partition_0' },
              { Name: 'partition_1' },
            ],
          },
          PartitionKeys: [{ Name: 'partition_0' }, { Name: 'partition_1' }],
        },
      ] as Glue.Table[],
    });

    const result = await handler(
      {
        Payload: {
          tablePrefix: TABLE_PREFIX,
          databaseName: DATABASE_NAME,
        },
      },
      null,
    );

    expect(mockDeletePartitionIndex).toHaveBeenCalledTimes(2);
    expect(mockUpdateTable).toHaveBeenCalledTimes(2);
    expect(mockUpdateTable).toHaveBeenCalledWith(
      expect.objectContaining({
        TableInput: {
          ...pick(mockTable, UPDATE_TABLE_KEYS),
          Name: TABLE_PREFIX + 'table1',
          PartitionKeys: [],
        },
      }),
    );
    expect(mockUpdateTable).toHaveBeenCalledWith(
      expect.objectContaining({
        TableInput: {
          ...pick(mockTable, UPDATE_TABLE_KEYS),
          Name: TABLE_PREFIX + 'table2',
          PartitionKeys: [],
        },
      }),
    );

    expect(result.tableDetails).toEqual([
      expectedTableDetails(TABLE_PREFIX, 'table1'),
      // should not have partition columns in it
      expectedTableDetails(TABLE_PREFIX, 'table2'),
    ]);
  });

  it('should preserve kinesis partition keys but still remove glue keys', async () => {
    const table: Glue.Table = {
      ...mockTable,
      Name: TABLE_PREFIX + 'table1',
      StorageDescriptor: {
        ...mockTable.StorageDescriptor,
        Columns: [
          ...(mockTable.StorageDescriptor?.Columns || []),
          { Name: 'year' },
          { Name: 'month' },
          { Name: 'day' },
        ],
      },
      PartitionKeys: [{ Name: 'year' }, { Name: 'month' }, { Name: 'day' }],
    };

    mockGetTables.mockReturnValue({
      TableList: [
        {
          ...table,
          StorageDescriptor: {
            ...table.StorageDescriptor,
            Columns: [...(table.StorageDescriptor?.Columns || []), { Name: 'partition_0' }, { Name: 'partition_1' }],
          },
          PartitionKeys: [...table.PartitionKeys!, { Name: 'partition_0' }, { Name: 'partition_1' }],
        },
      ] as Glue.Table[],
    });

    const result = await handler(
      {
        Payload: {
          tablePrefix: TABLE_PREFIX,
          databaseName: DATABASE_NAME,
        },
      },
      null,
    );

    expect(mockDeletePartitionIndex).toHaveBeenCalledTimes(1);
    expect(mockUpdateTable).toHaveBeenCalledTimes(1);
    expect(mockUpdateTable).toHaveBeenCalledWith(
      expect.objectContaining({
        TableInput: {
          ...pick(table, UPDATE_TABLE_KEYS),
          Name: TABLE_PREFIX + 'table1',
          PartitionKeys: [{ Name: 'year' }, { Name: 'month' }, { Name: 'day' }],
        },
      }),
    );

    expect(result.tableDetails).toEqual([expectedTableDetails(TABLE_PREFIX, 'table1', table)]);
  });

  it('should not throw an error if the getTables API returns more than 1 element', async () => {
    mockGetTables.mockReturnValue({
      TableList: [
        { ...mockTable, Name: TABLE_PREFIX + 'table1' },
        { ...mockTable, Name: TABLE_PREFIX + 'table2' },
      ],
    });

    const result = await handler(
      {
        Payload: {
          tablePrefix: TABLE_PREFIX,
          databaseName: DATABASE_NAME,
        },
      },
      null,
    );

    expect(result.tablePrefix).toBe(TABLE_PREFIX);
    expect(result.databaseName).toBe(DATABASE_NAME);
    expect(result.tableDetails).toEqual([
      expectedTableDetails(TABLE_PREFIX, 'table1'),
      expectedTableDetails(TABLE_PREFIX, 'table2'),
    ]);
  });

  it('should throw an error if the getTables API returns undefined or empty', async () => {
    mockGetTables.mockReturnValue({
      TableList: undefined,
    });

    await expect(
      handler(
        {
          Payload: {
            tablePrefix: TABLE_PREFIX,
            databaseName: DATABASE_NAME,
          },
        },
        null,
      ),
    ).rejects.toThrow(`Tables with prefix ${TABLE_PREFIX} not found in database dbName`);

    mockGetTables.mockReturnValue({
      TableList: [],
    });

    await expect(
      handler(
        {
          Payload: {
            tablePrefix: TABLE_PREFIX,
            databaseName: DATABASE_NAME,
          },
        },
        null,
      ),
    ).rejects.toThrow(`Tables with prefix ${TABLE_PREFIX} not found in database dbName`);
  });
});
