/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallingUser, DefaultGroupIds, DefaultUser } from '@ada/common';
import { DEFAULT_CALLER, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { ScriptBucket } from '../../../components/s3/script';
import { ScriptIdentifier, ScriptInput } from '@ada/api';
import { ScriptStore } from '../../../components/ddb/script';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildApiRequest } from '@ada/api-gateway';
import { cause } from 'verror';
import { handler } from '../put-script';

jest.mock('@ada/api-client-lambda');

describe('put-script', () => {
  const before = '2020-01-01T00:00:00.000Z';
  const now = '2021-01-01T00:00:00.000Z';
  const s3Mock = {
    putObject: jest.fn().mockReturnThis(),
    promise: jest.fn(),
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
    jest.clearAllMocks();

    API.getDataProductDomain.mockResolvedValue({});
    API.postDataProductScriptsValidate.mockResolvedValue({ report: { passed: true } });
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the handler
  const putScriptHandler = (
    scriptIdentifier: ScriptIdentifier,
    script: ScriptInput,
    callingUser: CallingUser = { userId: 'test-user', username: 'test-user@usr.example.com', groups: ['admin', 'analyst'] },
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(callingUser, {
        pathParameters: scriptIdentifier as unknown as any,
        body: script,
      }) as any,
      null,
    );

  it('should create and update a script', async () => {
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

    s3Mock.promise
      .mockReturnValueOnce({
        VersionId: 1,
      })
      .mockReturnValueOnce({
        VersionId: 2,
      });

    const scriptIdentifier = { namespace: 'sample', scriptId: 'script-id-sample' };
    const response = await putScriptHandler(scriptIdentifier, script);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expectedScript);
    expect(await testScriptStore.getScript(scriptIdentifier)).toEqual(expectedScript);
    expect(s3Mock.putObject).toHaveBeenCalledWith({
      Bucket: process.env.SCRIPT_BUCKET_NAME,
      Key: 'scripts/sample/script-id-sample/transform_script.py',
      Body: script.source,
    });

    const updatedScript = {
      ...script,
      description: 'new description',
      source: `
        var x = 1;
        console.log(x)
      `,
      updatedTimestamp: now,
    };
    const expectedUpdatedScript = {
      ...updatedScript,
      scriptId: 'script-id-sample',
      namespace: 'sample',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
      versionId: 2,
      source: `s3://${process.env.SCRIPT_BUCKET_NAME}/scripts/sample/script-id-sample/transform_script.py`,
    };

    const updateResponse = await putScriptHandler(scriptIdentifier, updatedScript);

    expect(updateResponse.statusCode).toBe(200);
    expect(JSON.parse(updateResponse.body)).toEqual(expectedUpdatedScript);
    expect(await testScriptStore.getScript(scriptIdentifier)).toEqual(expectedUpdatedScript);
    expect(s3Mock.putObject).toHaveBeenCalledWith({
      Bucket: process.env.SCRIPT_BUCKET_NAME,
      Key: 'scripts/sample/script-id-sample/transform_script.py',
      Body: updatedScript.source,
    });
  });

  it('should NOT create if item with same id exists', async () => {
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

    s3Mock.promise
      .mockReturnValueOnce({
        VersionId: 1,
      })
      .mockReturnValueOnce({
        VersionId: 2,
      });

    const scriptIdentifier = { namespace: 'sample', scriptId: 'script-id-sample' };
    const response = await putScriptHandler(scriptIdentifier, script);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expectedScript);
    expect(await testScriptStore.getScript(scriptIdentifier)).toEqual(expectedScript);
    expect(s3Mock.putObject).toHaveBeenCalledWith({
      Bucket: process.env.SCRIPT_BUCKET_NAME,
      Key: 'scripts/sample/script-id-sample/transform_script.py',
      Body: script.source,
    });

    const duplicateScript = {
      ...script,
      description: 'new description',
      source: `
        var x = 1;
        console.log(x)
      `,
    };
    const expectedUpdatedScript = {
      ...duplicateScript,
      scriptId: 'script-id-sample',
      namespace: 'sample',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
      versionId: 2,
      source: `s3://${process.env.SCRIPT_BUCKET_NAME}/scripts/sample/script-id-sample/transform_script.py`,
    };

    const updateResponse = await putScriptHandler(scriptIdentifier, duplicateScript);

    expect(updateResponse.statusCode).toBe(400);
    expect(JSON.parse(updateResponse.body)?.message).toContain('Item with same id already exists');
  });

  it('should NOT update if updatedTimestamp does not match', async () => {
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

    s3Mock.promise
      .mockReturnValueOnce({
        VersionId: 1,
      })
      .mockReturnValueOnce({
        VersionId: 2,
      });

    const scriptIdentifier = { namespace: 'sample', scriptId: 'script-id-sample' };
    const response = await putScriptHandler(scriptIdentifier, script);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expectedScript);
    expect(await testScriptStore.getScript(scriptIdentifier)).toEqual(expectedScript);
    expect(s3Mock.putObject).toHaveBeenCalledWith({
      Bucket: process.env.SCRIPT_BUCKET_NAME,
      Key: 'scripts/sample/script-id-sample/transform_script.py',
      Body: script.source,
    });

    const updatedScript = {
      ...script,
      description: 'new description',
      updatedTimestamp: before,
      source: `
        var x = 1;
        console.log(x)
      `,
    };
    const expectedUpdatedScript = {
      ...updatedScript,
      scriptId: 'script-id-sample',
      namespace: 'sample',
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
      versionId: 2,
      source: `s3://${process.env.SCRIPT_BUCKET_NAME}/scripts/sample/script-id-sample/transform_script.py`,
    };

    const updateResponse = await putScriptHandler(scriptIdentifier, updatedScript);

    expect(updateResponse.statusCode).toBe(400);
    expect(JSON.parse(updateResponse.body)?.message).toContain('cannot be updated');
  });

  it('should fail to write the script if S3 upload fails', async () => {
    s3Mock.promise.mockRejectedValue(new Error('something wrong'));

    const script = {
      name: 'script name',
      description: 'script description',
      source: `
        var x = 0;
        alert(x)
      `,
    };

    const scriptIdentifier = { namespace: 'sample', scriptId: 'script-id-sample' };
    const response = await putScriptHandler(scriptIdentifier, script);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      name: 'PutScriptError',
      cause: 'Error storing the script with namespace sample and id script-id-sample: something wrong',
      message: 'Error storing the script with namespace sample and id script-id-sample: something wrong',
      errorId: expect.stringMatching(/\w{10}/),
    });
  });

  it('should not allow a different user to update a script', async () => {
    const script = {
      scriptId: 'forbidden',
      namespace: 'forbidden',
      name: 'script name',
      description: 'script description',
      source: `
        var x = 0;
        alert(x)
      `,
    };

    const scriptIdentifier = { scriptId: 'forbidden', namespace: 'forbidden' };
    await testScriptStore.putScript(scriptIdentifier, 'darthvader', script);

    const response = await putScriptHandler(scriptIdentifier, script, {
      userId: 'lukeskywalker',
      username: 'lukeskywalker@usr.example.com',
      groups: ['jedi'],
    });
    expect(response.statusCode).toBe(403);
  });

  it('should allow an admin to update a script if they were not the creator', async () => {
    s3Mock.promise.mockReturnValue({ VersionId: 1 });

    const script = {
      scriptId: 'forbidden',
      namespace: 'forbidden',
      name: 'script name',
      description: 'script description',
      source: `
        var x = 0;
        alert(x)
      `,
    };

    const scriptIdentifier = { scriptId: 'forbidden', namespace: 'forbidden' };
    const putScriptResponse = await testScriptStore.putScript(scriptIdentifier, 'darthvader', script);

    const response = await putScriptHandler(
      scriptIdentifier,
      {
        ...script,
        updatedTimestamp: putScriptResponse.updatedTimestamp,
      },
      {
        userId: 'lukeskywalker',
        username: 'lukeskywalker@usr.example.com',
        groups: [DefaultGroupIds.ADMIN],
      },
    );
    expect(response.statusCode).toBe(200);
  });

  it('should fail to write script if detects vulnerabilities', async () => {
    API.postDataProductScriptsValidate.mockResolvedValue({ report: { passed: false } });

    const script = {
      name: 'script name',
      description: 'script description',
      source: `
        var x = 0;
        alert(x)
      `,
    };

    const scriptIdentifier = { namespace: 'sample', scriptId: 'script-id-sample' };
    const response = await putScriptHandler(scriptIdentifier, script);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        name: 'InvalidScriptError',
        message: 'Script script-id-sample contains vulnerabilities',
      }),
    );
  });

  it('should fail to write script if validation scan errors', async () => {
    API.postDataProductScriptsValidate.mockRejectedValue(new Error('Internal server error scanning'));

    const script = {
      name: 'script name',
      description: 'script description',
      source: `
        var x = 0;
        alert(x)
      `,
    };

    const scriptIdentifier = { namespace: 'sample', scriptId: 'script-id-sample' };
    const response = await putScriptHandler(scriptIdentifier, script);
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        name: 'Error',
        message: 'Internal server error scanning',
      }),
    );
  });

  it('should not check a script for vulnerabilities as the system user', async () => {
    const script = {
      name: 'script name',
      description: 'script description',
      source: `
        var x = 0;
        alert(x)
      `,
    };

    const scriptIdentifier = { namespace: 'sample', scriptId: 'script-id-sample' };
    const response = await putScriptHandler(scriptIdentifier, script, {
      ...DEFAULT_CALLER,
      userId: DefaultUser.SYSTEM,
    });
    expect(response.statusCode).toBe(200);
    expect(API.postDataProductScriptsValidate).not.toHaveBeenCalled();
  });
});
