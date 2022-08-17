/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { OntologyIdentifier } from '@ada/api-client';
import { OntologyNamespace } from '@ada/common';
import { OntologyStore } from '../../../components/ddb/ontology';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../get-ontology';

// Mock the ontology store to point to our local dynamodb
const testOntologyStore = new (OntologyStore as any)(getLocalDynamoDocumentClient());
OntologyStore.getInstance = jest.fn(() => testOntologyStore);

describe('get-ontology', () => {
  const now = '2021-01-01T00:00:00.000Z';

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  // Helper method for calling the handler
  const getOntologyHandler = (ontologyId: OntologyIdentifier): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: ontologyId,
      }),
      null,
    );

  it('should return an ontology if the ontologyId exists', async () => {
    const ontology = {
      name: 'test name',
      description: 'test description',
      aliases: [
        {
          name: 'create-update-test-alias-1',
        },
        {
          name: 'create-update-test-alias-2',
        },
      ],
    };

    // Create our new ontology
    await testOntologyStore.putOntology(
      { ontologyId: 'get-ontology-id', ontologyNamespace: OntologyNamespace.DEFAULT },
      'test-user',
      ontology,
    );

    const expectedOntology = {
      ...ontology,
      ontologyId: 'get-ontology-id',
      ontologyNamespace: OntologyNamespace.DEFAULT,
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };

    const response = await getOntologyHandler({
      ontologyId: 'get-ontology-id',
      ontologyNamespace: OntologyNamespace.DEFAULT,
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expectedOntology);
  });

  it('should return 404 if ontologyId does not exist', async () => {
    const response = await getOntologyHandler({
      ontologyId: 'ontology-id-does-not-exist',
      ontologyNamespace: OntologyNamespace.DEFAULT,
    });
    expect(response.statusCode).toBe(404);
    expect(response.body).toContain('ontology-id-does-not-exist');
  });
});
