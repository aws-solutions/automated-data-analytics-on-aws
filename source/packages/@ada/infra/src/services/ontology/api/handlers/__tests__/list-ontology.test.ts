/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyEventQueryStringParameters, APIGatewayProxyResult } from 'aws-lambda';
import { Ontology } from '@ada/api';
import { OntologyIdentifier } from '@ada/api-client';
import { OntologyNamespace } from '@ada/common';
import { OntologyStore } from '../../../components/ddb/ontology';
import { apiGatewayEvent, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { handler } from '../list-ontology';

// Mock the ontology store to point to our local dynamodb
const testOntologyStore = new (OntologyStore as any)(getLocalDynamoDocumentClient());
OntologyStore.getInstance = jest.fn(() => testOntologyStore);

describe('list-ontology', () => {
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
  const listOntolgiesHandler = (
    queryStringParameters?: APIGatewayProxyEventQueryStringParameters,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        queryStringParameters,
      }),
      null,
    );

  const putGeneratedOntology = (ontologyId: OntologyIdentifier) =>
    testOntologyStore.putOntology(ontologyId, 'test-user', {
      name: 'test name',
      description: 'test description',
      aliases: [
        {
          name: `${ontologyId}-alias-1`,
        },
        {
          name: `${ontologyId}-alias-2`,
        },
      ],
    });

  const putBatchGeneratedOntology = async () => {
    await Promise.all([
      putGeneratedOntology({ ontologyId: 'list-ontologies-test-1', ontologyNamespace: OntologyNamespace.DEFAULT }),
      putGeneratedOntology({ ontologyId: 'list-ontologies-test-2', ontologyNamespace: OntologyNamespace.DEFAULT }),
      putGeneratedOntology({ ontologyId: 'list-ontologies-test-3', ontologyNamespace: OntologyNamespace.DEFAULT }),
      putGeneratedOntology({ ontologyId: 'list-ontologies-test-4', ontologyNamespace: OntologyNamespace.DEFAULT }),
    ]);
  };

  it('should list ontology attributes', async () => {
    let response = await listOntolgiesHandler();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).ontologies).toHaveLength(0);
    expect(JSON.parse(response.body)).not.toHaveProperty('nextToken');

    await putBatchGeneratedOntology();

    response = await listOntolgiesHandler();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).ontologies.map((o: Ontology) => o.ontologyId)).toIncludeSameMembers([
      'list-ontologies-test-1',
      'list-ontologies-test-2',
      'list-ontologies-test-3',
      'list-ontologies-test-4',
    ]);
    expect(JSON.parse(response.body)).not.toHaveProperty('nextToken');
  });

  it('should list ontology attributes with a limit', async () => {
    await putBatchGeneratedOntology();

    let response = await listOntolgiesHandler({ limit: '3' });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).ontologies).toHaveLength(3);
    expect(JSON.parse(response.body)).not.toHaveProperty('nextToken');

    response = await listOntolgiesHandler({ limit: '9999' });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).ontologies).toHaveLength(4);
    expect(JSON.parse(response.body)).not.toHaveProperty('nextToken');
  });

  it('should list ontology attributes with pagination', async () => {
    await putBatchGeneratedOntology();

    let response = await listOntolgiesHandler({ pageSize: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body);
    expect(firstPage.ontologies).toHaveLength(3);

    response = await listOntolgiesHandler({ pageSize: '3', nextToken: firstPage.nextToken });
    expect(response.statusCode).toBe(200);

    const secondPage = JSON.parse(response.body);
    expect(secondPage.ontologies).toHaveLength(1);
    expect(secondPage).not.toHaveProperty('nextToken');

    expect([...firstPage.ontologies, ...secondPage.ontologies].map((o: Ontology) => o.ontologyId)).toIncludeSameMembers(
      ['list-ontologies-test-1', 'list-ontologies-test-2', 'list-ontologies-test-3', 'list-ontologies-test-4'],
    );
  });

  it('should list ontology attributes with pagination and a limit', async () => {
    await putBatchGeneratedOntology();

    let response = await listOntolgiesHandler({ pageSize: '2', limit: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body);
    expect(firstPage.ontologies).toHaveLength(2);

    response = await listOntolgiesHandler({ pageSize: '2', limit: '3', nextToken: firstPage.nextToken });
    expect(response.statusCode).toBe(200);

    const secondPage = JSON.parse(response.body);
    expect(secondPage.ontologies).toHaveLength(1);
    expect(secondPage).not.toHaveProperty('nextToken');
  });

  it('should honour the limit of the initial request', async () => {
    await putBatchGeneratedOntology();

    let response = await listOntolgiesHandler({ pageSize: '2', limit: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body);
    expect(firstPage.ontologies).toHaveLength(2);

    // Limit in the second request should be ignored
    response = await listOntolgiesHandler({ pageSize: '2', limit: '9999', nextToken: firstPage.nextToken });
    expect(response.statusCode).toBe(200);

    // We should honour the original limit and return our one remaining ontology
    const secondPage = JSON.parse(response.body);
    expect(secondPage.ontologies).toHaveLength(1);
    expect(secondPage).not.toHaveProperty('nextToken');
  });

  it('should list ontology attributes with a limit smaller than page size', async () => {
    await putBatchGeneratedOntology();

    const response = await listOntolgiesHandler({ pageSize: '4', limit: '3' });
    expect(response.statusCode).toBe(200);

    const firstPage = JSON.parse(response.body);
    expect(firstPage.ontologies).toHaveLength(3);
  });

  it('should return 400 when given an invalid nextToken', async () => {
    const response = await listOntolgiesHandler({ nextToken: 'my-invalid-token' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('my-invalid-token');
  });

  it('should return 400 when given an invalid limit', async () => {
    const response = await listOntolgiesHandler({ limit: 'not-a-number' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('not-a-number');
  });

  it('should return 400 when given an invalid pageSize', async () => {
    const response = await listOntolgiesHandler({ pageSize: 'not-a-number' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('not-a-number');
  });
});
