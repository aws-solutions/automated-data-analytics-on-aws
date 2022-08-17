/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyEventQueryStringParameters, APIGatewayProxyResult } from 'aws-lambda';
import { ListQueryHistoryResponse, QueryHistoryStore } from '../../../components/ddb/query-history';
import { QueryHistory } from '@ada/api';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../list-query-history';

describe('list-query-history', () => {
  let testQueryHistoryStory: QueryHistoryStore;

  beforeAll(async () => {
    testQueryHistoryStory = new (QueryHistoryStore as any)(getLocalDynamoDocumentClient());
    QueryHistoryStore.getInstance = jest.fn(() => testQueryHistoryStory);
  });

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
  });

  // Helper method for calling the handler
  const listQueryHistoryHandler = (
    queryStringParameters?: APIGatewayProxyEventQueryStringParameters,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        queryStringParameters,
      }),
      null,
    );

  const putQueryHistory = (query: string, executionId: string, userId?: string) =>
    testQueryHistoryStory.putQueryHistory(
      {
        query,
        executionId,
      },
      userId || 'test-user',
    );

  it('should only list the query history of the given user', async () => {
    let response = await listQueryHistoryHandler();
    let listBody = JSON.parse(response.body) as ListQueryHistoryResponse;
    expect(response.statusCode).toBe(200);
    expect(listBody.queries).toHaveLength(0);
    expect(listBody).not.toHaveProperty('nextToken');

    await putQueryHistory('select * from bar', 'exec-1');
    await putQueryHistory('select * from foo', 'exec-2');
    await putQueryHistory('select * from bar.bar', 'exec-3');
    await putQueryHistory('select * from foo.foo', 'exec-4');
    await putQueryHistory('select * from another.one', 'exec-5', 'user-two');
    await putQueryHistory('select * from another.one', 'exec-6', 'user-two');

    const queries = [];
    let nextToken;
    do {
      response = await listQueryHistoryHandler({ nextToken });
      expect(response.statusCode).toBe(200);
      listBody = JSON.parse(response.body) as ListQueryHistoryResponse;
      nextToken = listBody.nextToken;
      queries.push(...listBody.queries);
    } while (nextToken);

    expect(queries).toHaveLength(4);
    expect(queries.map((o: QueryHistory) => o.executionId)).toIncludeSameMembers([
      'exec-1',
      'exec-2',
      'exec-3',
      'exec-4',
    ]);
  });

  it('should return bad requests for errors', async () => {
    testQueryHistoryStory.getUserQueryHistory = jest.fn().mockReturnValue({ error: 'bad query' });
    const response = await listQueryHistoryHandler();
    expect(testQueryHistoryStory.getUserQueryHistory).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toStrictEqual({ name: 'Error', message: 'bad query', errorId: expect.stringMatching(/\w{10}/) });
  });
});
