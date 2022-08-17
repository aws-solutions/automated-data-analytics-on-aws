/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ScriptBucket } from '../../../components/s3/script';
import { ScriptIdentifier, ScriptInput } from '@ada/api';
import { ScriptStore } from '../../../components/ddb/script';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { handler } from '../get-script';
import { handler as putScript } from '../put-script';

jest.mock('@ada/api-client-lambda');

// Mock the script store to point to our local dynamodb
const testScriptStore = new (ScriptStore as any)(getLocalDynamoDocumentClient());
ScriptStore.getInstance = jest.fn(() => testScriptStore);

describe('get-script', () => {
  const now = '2021-01-01T00:00:00.000Z';
  const s3Mock = {
    putObject: jest.fn().mockReturnThis(),
    promise: jest.fn(),
    getObject: jest.fn().mockReturnThis(),
  };
  let testScriptStore: ScriptStore;
  let testScriptBucket: ScriptBucket;

  beforeAll(async () => {
    testScriptStore = new (ScriptStore as any)(getLocalDynamoDocumentClient());
    ScriptStore.getInstance = jest.fn(() => testScriptStore);

    testScriptBucket = new (ScriptBucket as any)(s3Mock);
    ScriptBucket.getInstance = jest.fn(() => testScriptBucket);
  });

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());

    API.getDataProductDomain.mockResolvedValue({});
    API.postDataProductScriptsValidate.mockResolvedValue({
      report: {
        passed: true,
      },
    });
  });

  // Helper method for calling the handler
  const getScriptHandler = (scriptIdentifier: ScriptIdentifier): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: scriptIdentifier,
      }),
      null,
    );

  const putScriptHandler = (scriptIdentifier: ScriptIdentifier, script: ScriptInput): Promise<APIGatewayProxyResult> =>
    putScript(
      apiGatewayEvent({
        pathParameters: scriptIdentifier,
        body: JSON.stringify(script),
      }),
      null,
    );

  it('should return a script if the scriptId exists', async () => {
    const script = {
      name: 'script name',
      description: 'script description',
      source: `
          var x = 0;
          alert(x)
        `,
    };

    const expectedScript = {
      ...script,
      scriptId: 'script-id-sample',
      namespace: 'sample',
      source: `s3://${process.env.SCRIPT_BUCKET_NAME}/scripts/sample/script-id-sample/transform_script.py`,
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
      versionId: 1,
    };

    const scriptResponse = {
      Body: 'Contents...',
    };

    s3Mock.promise.mockReturnValueOnce({
      VersionId: 1,
    });

    s3Mock.promise.mockReturnValueOnce(scriptResponse);

    const scriptIdentifier = { namespace: 'sample', scriptId: 'script-id-sample' };

    const putResponse = await putScriptHandler(scriptIdentifier, script);
    expect(putResponse.statusCode).toBe(200);
    expect(JSON.parse(putResponse.body)).toEqual(expectedScript);
    const getResponse = await getScriptHandler(scriptIdentifier);
    expect(getResponse.statusCode).toBe(200);
    expect(JSON.parse(getResponse.body)).toEqual({
      ...expectedScript,
      source: scriptResponse.Body,
    });
  });

  it('should return 404 if script does not exist', async () => {
    const response = await getScriptHandler({ namespace: 'sample', scriptId: 'script-id-does-not-exist' });
    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('Not Found');
  });
});
