/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyEventQueryStringParameters, APIGatewayProxyResult } from 'aws-lambda';
import { Script, ScriptIdentifier } from '@ada/api';
import { ScriptStore } from '../../../components/ddb/script';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../list-script';

describe('list-script', () => {
  const now = '2021-01-01T00:00:00.000Z';

  let testScriptStore: ScriptStore;

  beforeAll(async () => {
    testScriptStore = new (ScriptStore as any)(getLocalDynamoDocumentClient());
    ScriptStore.getInstance = jest.fn(() => testScriptStore);
  });

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
  });

  // Helper method for calling the handler
  const listScriptsHandler = (
    queryStringParameters?: APIGatewayProxyEventQueryStringParameters,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        queryStringParameters,
      }),
      null,
    );

  const putGeneratedScript = (scriptIdentifier: ScriptIdentifier) =>
    testScriptStore.putScript(scriptIdentifier, 'test-user', {
      name: 'script name',
      description: 'script description',
      source: `
    var x = 0;
    alert(x)
  `,
      scriptId: scriptIdentifier.scriptId,
      namespace: scriptIdentifier.namespace,
    });

  it('should list scripts', async () => {
    let response = await listScriptsHandler();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).scripts).toHaveLength(0);
    expect(JSON.parse(response.body)).not.toHaveProperty('nextToken');

    await Promise.all([
      putGeneratedScript({ namespace: 'test-namespace', scriptId: 'list-scripts-test-1' }),
      putGeneratedScript({ namespace: 'test-namespace', scriptId: 'list-scripts-test-2' }),
      putGeneratedScript({ namespace: 'test-namespace', scriptId: 'list-scripts-test-3' }),
      putGeneratedScript({ namespace: 'another-namespace', scriptId: 'another-namespace-script-1' }),
      putGeneratedScript({ namespace: 'another-namespace', scriptId: 'another-namespace-script-2' }),
      putGeneratedScript({ namespace: 'test-namespace', scriptId: 'list-scripts-test-4' }),
    ]);

    response = await listScriptsHandler();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).scripts.map((o: Script) => o.scriptId)).toIncludeSameMembers([
      'list-scripts-test-1',
      'list-scripts-test-2',
      'list-scripts-test-3',
      'another-namespace-script-1',
      'another-namespace-script-2',
      'list-scripts-test-4',
    ]);
    expect(JSON.parse(response.body)).not.toHaveProperty('nextToken');
  });

  it('should return bad request for errors', async () => {
    testScriptStore.listScripts = jest.fn().mockReturnValue({ error: 'bad script' });
    const response = await listScriptsHandler();
    expect(testScriptStore.listScripts).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toStrictEqual({
      name: 'Error',
      message: 'bad script',
      errorId: expect.stringMatching(/\w{10}/),
    });
  });
});
