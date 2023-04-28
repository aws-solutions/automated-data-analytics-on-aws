/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { executionAsyncId } from 'async_hooks';
import { getCreateAndUpdateDetails, fetchPageWithScan, fetchPageWithQuery, getTotals, updateCounter, GenericDynamodbStore } from '../../ddb';

const originalEnv = process.env;
const testTableName = 'TestTableName';
const testCounterTableName = 'TestCounterTableName';

const testExclusiveStartKey = {
  'key': {
    'S': 'value',
  }
}

describe('dynamo-crud-operations', () => {
  afterEach(() => {
    jest.resetAllMocks();
  })

  describe('getCreateAndUpdateDetails', () => {
    const now = '2021-01-01T00:00:00.000Z';

    beforeEach(() => {
      jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return the create and update details when an item is first created', () => {
      expect(getCreateAndUpdateDetails('test-user', undefined)).toEqual({
        createdBy: 'test-user',
        updatedBy: 'test-user',
        createdTimestamp: now,
        updatedTimestamp: now,
      });
    });

    it('should return the create and update details when an item is subsequently updated', () => {
      expect(
        getCreateAndUpdateDetails('test-user', {
          createdBy: 'another-user',
          updatedBy: 'yet-another-user',
          createdTimestamp: '1991-01-01T00:00:00.000Z',
          updatedTimestamp: '2001-01-01T00:00:00.000Z',
        }),
      ).toEqual({
        createdBy: 'another-user',
        updatedBy: 'test-user',
        createdTimestamp: '1991-01-01T00:00:00.000Z',
        updatedTimestamp: now,
      });
    });
  });

  describe('fetchPageWithScan', () => {
    it('should call ddb.scan', async () => {
      const props: any = {
        filterExpression: 'testFilterExpression',
        expressionAttributeNames: 'testExpressionAttributeNames',
        expressionAttributeValues: 'testExpressionAttributeValues',
      };
      const ddb: any = {
        scan: jest.fn().mockReturnValue({
          promise: jest.fn().mockResolvedValue({})
        })
      };

      await fetchPageWithScan(props)({
        ddb,
        tableName: testTableName,
        limit: 1000,
        exclusiveStartKey: testExclusiveStartKey,
      });

      expect(ddb.scan).toHaveBeenCalledWith({
        TableName: testTableName,
        Limit: 1000,
        ExclusiveStartKey: testExclusiveStartKey,
        ExpressionAttributeNames: props.expressionAttributeNames,
        ExpressionAttributeValues: props.expressionAttributeValues,
        FilterExpression: props.filterExpression,
      })
    });
  });

  describe('getTotals', () => {
    beforeAll(() => {
      jest.resetModules();
      process.env = {
        ...originalEnv,
        COUNTER_TABLE_NAME: testCounterTableName,
      };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should call ddb.get on counter table', async () => {
      const ddb: any = {
        get: jest.fn().mockReturnValue({
          promise: jest.fn().mockResolvedValue({})
        })
      };

      await getTotals(ddb, testTableName);

      expect(ddb.get).toHaveBeenCalledWith({
        TableName: testCounterTableName,
        Key: {
          tableName: testTableName,
        }
      })
    });
  });

  describe('fetchPageWithQuery', () => {
    it('should call ddb.query and return page', async () => {
      const props: any = {
        indexName: 'testIndexName',
        scanIndexForward: 'testCcanIndexForward',
        keyConditionExpression: 'testKeyConditionExpression',
        expressionAttributeNames: 'testExpressionAttributeNames',
        expressionAttributeValues: 'testExpressionAttributeValues',
      };
      const ddb: any = {
        query: jest.fn().mockReturnValue({
          promise: jest.fn().mockResolvedValue({})
        })
      };

      await fetchPageWithQuery(props)({
        ddb,
        tableName: testTableName,
        limit: 1000,
        exclusiveStartKey: testExclusiveStartKey,
      });

      expect(ddb.query).toHaveBeenCalledWith({
        TableName: testTableName,
        IndexName: props.indexName,
        Limit: 1000,
        ExclusiveStartKey: testExclusiveStartKey,
        ExpressionAttributeNames: props.expressionAttributeNames,
        ExpressionAttributeValues: props.expressionAttributeValues,
        KeyConditionExpression: props.keyConditionExpression,
        ScanIndexForward: props.scanIndexForward,
      });
    });
  });

  describe('updateCounter', () => {
    beforeAll(() => {
      jest.resetModules();
      process.env = {
        ...originalEnv,
        COUNTER_TABLE_NAME: testCounterTableName,
      };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should call ddb.Scan and return page', () => {
      const result = updateCounter(testTableName, 10);

      expect(result).toEqual({
        Update: {
          TableName: testCounterTableName,
          UpdateExpression: 'set #count = #count + :num',
          ExpressionAttributeNames: { '#count': 'count' },
          ExpressionAttributeValues: { ':num': 10 },
          Key: {
            tableName: testTableName,
          },
        },
      })
    });
  });

  describe('GenericDynamodbStore', () => {
    beforeAll(() => {
      jest.resetModules();
      process.env = {
        ...originalEnv,
        COUNTER_TABLE_NAME: testCounterTableName,
      };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    const mockResult = { 
      promise: jest.fn()
    }

    const ddb: any = {
      get: jest.fn(),
    }

    it('should be able to ddb get', async () => {
      const store = new GenericDynamodbStore(ddb, testTableName, false);
      mockResult.promise.mockResolvedValue({
        Item: 'item'
      });

      ddb.get.mockReturnValue(mockResult);

      const result = await store.get({
        'key': {
          'S': 1
        }
      });

      expect(result).toEqual('item');
    });
  });
});
