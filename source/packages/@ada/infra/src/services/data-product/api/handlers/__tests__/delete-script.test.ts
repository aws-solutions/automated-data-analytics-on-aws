/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallingUser, DefaultGroupIds } from '@ada/common';
import { DEFAULT_CALLER, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { IRelationshipClient } from '../../../../api/components/entity/relationships/client';
import { ScriptBucket } from '../../../components/s3/script';
import { ScriptIdentifier, ScriptInput } from '@ada/api';
import { ScriptStore } from '../../../components/ddb/script';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildApiRequest } from '@ada/api-gateway';
import { entityIdentifier } from '@ada/api-client/types';
import { getScriptS3Key } from '@ada/microservice-common';
import { handler } from '../delete-script';
import { localDynamoLockClient } from '../../../../api/components/entity/locks/mock';
import { localDynamoRelationshipClient } from '../../../../api/components/entity/relationships/mock';

jest.mock('@ada/api-client-lambda');

describe('delete-script', () => {
  const mockGetObject = jest.fn();
  const mockDeleteObject = jest.fn();
  const s3Mock = {
    getObject: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockGetObject(...args))),
    }),
    deleteObject: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDeleteObject(...args))),
    }),
  };
  let testScriptStore: ScriptStore;
  let testScriptBucket: ScriptBucket;

  beforeAll(async () => {
    testScriptStore = new (ScriptStore as any)(getLocalDynamoDocumentClient());
    ScriptStore.getInstance = jest.fn(() => testScriptStore);

    testScriptBucket = new (ScriptBucket as any)(s3Mock);
    ScriptBucket.getInstance = jest.fn(() => testScriptBucket);
  });

  let relationshipClient: IRelationshipClient;

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.clearAllMocks();
    localDynamoLockClient();
    relationshipClient = localDynamoRelationshipClient();
  });

  // Helper method for calling the handler
  const deleteScriptHandler = (
    scriptIdentifier: ScriptIdentifier,
    callingUser: CallingUser = DEFAULT_CALLER,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(callingUser, {
        pathParameters: { ...scriptIdentifier },
      }) as any,
      null,
    );

  const namespace = 'namespace';
  const scriptId = 'script';

  it('should not delete a script that is used by a data product', async () => {
    // Relate the script to a data product
    await relationshipClient.addRelationships(
      DEFAULT_CALLER,
      entityIdentifier('DataProductDomainDataProduct', { domainId: 'domain', dataProductId: 'data-product' }),
      [entityIdentifier('DataProductScript', { namespace, scriptId })],
    );

    const response = await deleteScriptHandler({
      namespace,
      scriptId,
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('domain.data-product');
  });

  it('should return 404 when the script does not exist', async () => {
    const response = await deleteScriptHandler({
      namespace,
      scriptId,
    });
    expect(response.statusCode).toBe(404);
  });

  it('should delete a script', async () => {
    // Relate the script to the domain
    const scriptEntity = entityIdentifier('DataProductScript', { namespace, scriptId });
    await relationshipClient.addRelationships(
      DEFAULT_CALLER,
      entityIdentifier('DataProductDomain', { domainId: 'domain' }),
      [scriptEntity],
    );

    const script = {
      namespace,
      scriptId,
      name: 'Script',
    };
    const source = 'def apply_transforms(...';
    await testScriptStore.putScript({ namespace, scriptId }, 'test-user', script);
    mockGetObject.mockReturnValue({
      Body: source,
    });

    const response = await deleteScriptHandler({
      namespace,
      scriptId,
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        ...script,
        source,
      }),
    );

    expect(mockDeleteObject).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: getScriptS3Key({ namespace, scriptId }),
      }),
    );

    expect(await relationshipClient.getRelatedEntities(scriptEntity)).toHaveLength(0);
  });

  it('should not delete a script if the user is not the same as the one who created the script', async () => {
    // Relate the script to the domain
    const scriptEntity = entityIdentifier('DataProductScript', { namespace, scriptId });
    await relationshipClient.addRelationships(
      DEFAULT_CALLER,
      entityIdentifier('DataProductDomain', { domainId: 'domain' }),
      [scriptEntity],
    );

    const script = {
      namespace,
      scriptId,
      name: 'Script',
    };
    const source = 'def apply_transforms(...';
    await testScriptStore.putScript({ namespace, scriptId }, 'test-user', script);
    mockGetObject.mockReturnValue({
      Body: source,
    });

    const response = await deleteScriptHandler(
      {
        namespace,
        scriptId,
      },
      {
        userId: 'different-user',
        username: 'any',
        groups: [DefaultGroupIds.DEFAULT],
      },
    );

    expect(response.statusCode).toBe(403);
    expect(mockDeleteObject).not.toHaveBeenCalled();
    expect(await relationshipClient.getRelatedEntities(scriptEntity)).toHaveLength(1);
  });

  it('should delete a script if the user is not the same but belongs to adming group', async () => {
    // Relate the script to the domain
    const scriptEntity = entityIdentifier('DataProductScript', { namespace, scriptId });
    await relationshipClient.addRelationships(
      DEFAULT_CALLER,
      entityIdentifier('DataProductDomain', { domainId: 'domain' }),
      [scriptEntity],
    );

    const script = {
      namespace,
      scriptId,
      name: 'Script',
    };
    const source = 'def apply_transforms(...';
    await testScriptStore.putScript({ namespace, scriptId }, 'test-user', script);
    mockGetObject.mockReturnValue({
      Body: source,
    });

    const response = await deleteScriptHandler(
      {
        namespace,
        scriptId,
      },
      {
        userId: 'different-user',
        username: 'any',
        groups: [DefaultGroupIds.DEFAULT, DefaultGroupIds.ADMIN],
      },
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        ...script,
        source,
      }),
    );
    expect(mockDeleteObject).toHaveBeenCalledWith(
      expect.objectContaining({
        Key: getScriptS3Key({ namespace, scriptId }),
      }),
    );
    expect(await relationshipClient.getRelatedEntities(scriptEntity)).toHaveLength(0);
  });
});
