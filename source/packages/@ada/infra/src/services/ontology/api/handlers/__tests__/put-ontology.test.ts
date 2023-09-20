/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import * as _ from 'lodash';
import { APIGatewayProxyResult } from 'aws-lambda';
import { LensProperty } from '@ada/infra-common/constructs/api';
import { Ontology, OntologyIdentifier } from '@ada/api';
import { OntologyNamespace } from '@ada/common';
import { OntologyStore } from '../../../components/ddb/ontology';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  apiGatewayEvent,
  apiGatewayEventWithEmptyDefaults,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { handler } from '../put-ontology';

// Mock the ontology store to point to our local dynamodb
const testOntologyStore = new (OntologyStore as any)(getLocalDynamoDocumentClient());
OntologyStore.getInstance = jest.fn(() => testOntologyStore);

describe('put-ontology', () => {
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
  const putOntologyHandler = (
    ontologyIdentifier: OntologyIdentifier,
    ontology: Omit<Ontology, 'ontologyId' | 'ontologyNamespace'>,
    requestContext?: object,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      apiGatewayEvent({
        pathParameters: ontologyIdentifier,
        body: JSON.stringify(ontology),
        requestContext,
      }),
      null,
    );

  it('should create and update ontology attributes', async () => {
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
    const response = await putOntologyHandler(
      { ontologyId: 'create-update-test-ontology-id', ontologyNamespace: OntologyNamespace.DEFAULT },
      ontology,
    );
    expect(response.statusCode).toBe(200);

    const expectedOntology = {
      ...ontology,
      ontologyId: 'create-update-test-ontology-id',
      ontologyNamespace: OntologyNamespace.DEFAULT,
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };
    expect(JSON.parse(response.body)).toEqual(expectedOntology);

    // Check the ontology is written to dynamodb
    expect(
      await testOntologyStore.getOntology({
        ontologyId: 'create-update-test-ontology-id',
        ontologyNamespace: OntologyNamespace.DEFAULT,
      }),
    ).toEqual(expectedOntology);

    // Check the alias mappings are correct
    expect(
      await Promise.all([
        testOntologyStore.getAlias('create-update-test-alias-1'),
        testOntologyStore.getAlias('create-update-test-alias-2'),
      ]),
    ).toEqual([
      {
        alias: 'create-update-test-alias-1',
        ontologyId: 'create-update-test-ontology-id',
        ontologyNamespace: OntologyNamespace.DEFAULT,
      },
      {
        alias: 'create-update-test-alias-2',
        ontologyId: 'create-update-test-ontology-id',
        ontologyNamespace: OntologyNamespace.DEFAULT,
      },
    ]);

    const updatedOntology = {
      ...ontology,
      description: 'new description',
      aliases: [
        {
          name: 'create-update-test-alias-1',
        },
        {
          name: 'create-update-test-alias-3',
        },
      ],
    };

    // Update the ontology, adding and removing some aliases
    // Create our new ontology
    const updateResponse = await putOntologyHandler(
      { ontologyId: 'create-update-test-ontology-id', ontologyNamespace: OntologyNamespace.DEFAULT },
      updatedOntology,
    );
    expect(updateResponse.statusCode).toBe(200);

    const expectedUpdatedOntology = {
      ...updatedOntology,
      ontologyId: 'create-update-test-ontology-id',
      ontologyNamespace: OntologyNamespace.DEFAULT,
      createdBy: 'test-user',
      updatedBy: 'test-user',
      createdTimestamp: now,
      updatedTimestamp: now,
    };
    expect(JSON.parse(updateResponse.body)).toEqual(expectedUpdatedOntology);

    // Check the ontology is written to dynamodb
    expect(
      await testOntologyStore.getOntology({
        ontologyId: 'create-update-test-ontology-id',
        ontologyNamespace: OntologyNamespace.DEFAULT,
      }),
    ).toEqual(expectedUpdatedOntology);

    // Check the alias mappings are correct
    expect(
      await Promise.all([
        testOntologyStore.getAlias('create-update-test-alias-1'),
        testOntologyStore.getAlias('create-update-test-alias-3'),
      ]),
    ).toEqual([
      {
        alias: 'create-update-test-alias-1',
        ontologyId: 'create-update-test-ontology-id',
        ontologyNamespace: OntologyNamespace.DEFAULT,
      },
      {
        alias: 'create-update-test-alias-3',
        ontologyId: 'create-update-test-ontology-id',
        ontologyNamespace: OntologyNamespace.DEFAULT,
      },
    ]);

    expect(await testOntologyStore.getAlias('create-update-test-alias-2')).toBeUndefined();
  });

  it('should return 400 if there are clashing aliases', async () => {
    // Create our new ontology
    const firstResponse = await putOntologyHandler(
      { ontologyId: 'clashing-test-ontology-id-1', ontologyNamespace: OntologyNamespace.DEFAULT },
      {
        name: 'test name',
        description: 'test description',
        aliases: [
          {
            name: 'clashing-test-ontology-alias-1',
          },
          {
            name: 'clashing-test-ontology-alias-2',
          },
        ],
      },
    );

    expect(firstResponse.statusCode).toBe(200);

    // Create our new ontology
    const secondResponse = await putOntologyHandler(
      { ontologyId: 'clashing-test-ontology-id-2', ontologyNamespace: OntologyNamespace.DEFAULT },
      {
        name: 'another name',
        description: 'test description',
        aliases: [
          {
            name: 'clashing-test-ontology-alias-1',
          },
          {
            name: 'clashing-test-ontology-alias-3',
          },
        ],
      },
    );

    expect(secondResponse.statusCode).toBe(400);
    expect(secondResponse.body).toContain('clashing-test-ontology-alias-1');
  });

  it('should create an ontology with more than 25 aliases', async () => {
    const ontology = {
      name: 'test name',
      description: 'test description',
      aliases: _.range(100).map((n) => ({ name: `over-25-aliases-test-alias-${n}` })),
    };

    // Create our new ontology
    const response = await putOntologyHandler(
      { ontologyId: 'over-25-aliases-test-ontology-id', ontologyNamespace: OntologyNamespace.DEFAULT },
      ontology,
    );

    expect(response.statusCode).toBe(200);
  });

  it('should not be able to create an onotology in the PII_CLASSIFICATIONS namespace', async () => {
    const ontology = {
      name: 'test name',
      description: 'test description',
      ontologyNamespace: OntologyNamespace.PII_CLASSIFICATIONS,
      aliases: [],
    };

    // Create our new ontology
    const response = await putOntologyHandler(
      { ontologyId: 'over-25-aliases-test-ontology-id', ontologyNamespace: OntologyNamespace.PII_CLASSIFICATIONS },
      ontology,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('Invalid ontology namespace');
  });

  it('only system user should be able to insert pii ontologies', async () => {
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

    const pathParams = { ontologyId: 'pii-ontology-id-1', ontologyNamespace: OntologyNamespace.PII_CLASSIFICATIONS };
    // Create our new ontology
    let response = await putOntologyHandler(pathParams, ontology, {
      authorizer: {
        'x-user-id': '00',
        'x-groups': 'system',
        'x-username': 'system',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('Invalid ontology namespace');

    response = await putOntologyHandler(pathParams, ontology, {
      authorizer: {
        'x-user-id': 'system',
        'x-groups': '00',
        'x-username': 'system',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('Invalid ontology namespace');

    response = await putOntologyHandler(pathParams, ontology, {
      authorizer: {
        'x-user-id': 'system',
        'x-groups': 'system',
        'x-username': 'system',
      },
    });
    expect(response.statusCode).toBe(200);

    const expectedResponse = {
      name: 'test name',
    };
    expect(JSON.parse(response.body)).toEqual(expectedResponse);

    const expectedOntology = {
      ...ontology,
      ontologyId: 'pii-ontology-id-1',
      ontologyNamespace: OntologyNamespace.PII_CLASSIFICATIONS,
      createdBy: 'system',
      updatedBy: 'system',
      createdTimestamp: now,
      updatedTimestamp: now,
    };

    // Check the ontology is written to dynamodb
    expect(
      await testOntologyStore.getOntology({
        ontologyId: 'pii-ontology-id-1',
        ontologyNamespace: OntologyNamespace.PII_CLASSIFICATIONS,
      }),
    ).toEqual(expectedOntology);
  });
});
