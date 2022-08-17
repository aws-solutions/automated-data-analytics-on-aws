/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API, Api } from '@ada/api-client/mock';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallingUser, DefaultGroupIds, OntologyNamespace, buildNamespaceAndAttributeId } from '@ada/common';
import { DEFAULT_CALLER, getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';
import { IRelationshipClient } from '../../../../api/components/entity/relationships/client';
import { Ontology, OntologyIdentifier } from '@ada/api';
import { OntologyStore } from '../../../components/ddb/ontology';
import { buildApiRequest } from '@ada/api-gateway';
import { entityIdentifier } from '@ada/api-client/types';
import { handler } from '../delete-ontology';
import { localDynamoLockClient } from '../../../../api/components/entity/locks/mock';
import { localDynamoRelationshipClient } from '../../../../api/components/entity/relationships/mock';

jest.mock('@ada/api-client-lambda');

// Mock the ontology store to point to our local dynamodb
const testOntologyStore = new (OntologyStore as any)(getLocalDynamoDocumentClient());
OntologyStore.getInstance = jest.fn(() => testOntologyStore);

describe('delete-ontology', () => {
  let relationshipClient: IRelationshipClient;

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    relationshipClient = localDynamoRelationshipClient();
    localDynamoLockClient();
  });

  // Helper method for calling the handler
  const deleteOntologyHandler = (
    ontologyIdentifier: OntologyIdentifier,
    callingUser: CallingUser = DEFAULT_CALLER,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(callingUser, {
        pathParameters: { ...ontologyIdentifier },
      }) as any,
      null,
    );

  it('should not allow deletion of pii ontologies', async () => {
    expect(
      (
        await deleteOntologyHandler({
          ontologyNamespace: OntologyNamespace.PII_CLASSIFICATIONS,
          ontologyId: 'some-pii-ontology',
        })
      ).statusCode,
    ).toBe(403);
  });

  it('should not allow deletion of an ontology in use by a data product', async () => {
    await relationshipClient.addRelationships(
      DEFAULT_CALLER,
      entityIdentifier('DataProductDomainDataProduct', { domainId: 'domain', dataProductId: 'data-product' }),
      [entityIdentifier('Ontology', { ontologyNamespace: 'namespace', ontologyId: 'ontology' })],
    );

    const response = await deleteOntologyHandler({
      ontologyNamespace: 'namespace',
      ontologyId: 'ontology',
    });
    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toContain('domain.data-product');
  });

  it('should return 404 when the ontology does not exist', async () => {
    const response = await deleteOntologyHandler({
      ontologyNamespace: 'namespace',
      ontologyId: 'ontology',
    });
    expect(response.statusCode).toBe(404);
  });

  it('should successfully delete an ontology', async () => {
    const ontologyNamespace = 'namespace';
    const ontologyId = 'ontology';
    const ontology: Ontology = {
      ontologyNamespace,
      ontologyId,
      name: 'Ontology',
      aliases: [],
    };
    await testOntologyStore.putOntology({ ontologyNamespace, ontologyId }, 'test-user', ontology);

    const response = await deleteOntologyHandler({
      ontologyNamespace,
      ontologyId,
    });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining(ontology));
  });

  it('should NOT delete an ontology if the user is different than the creator', async () => {
    const ontologyNamespace = 'namespace';
    const ontologyId = 'ontology';
    const ontology: Ontology = {
      ontologyNamespace,
      ontologyId,
      name: 'Ontology',
      aliases: [],
    };
    await testOntologyStore.putOntology({ ontologyNamespace, ontologyId }, 'test-user', ontology);

    const response = await deleteOntologyHandler(
      {
        ontologyNamespace,
        ontologyId,
      },
      {
        userId: 'different-user',
        username: 'any',
        groups: [DefaultGroupIds.DEFAULT],
      },
    );
    expect(response.statusCode).toBe(403);
  });

  it('should delete an ontology if the user is different than the creator but belongs to the adnins', async () => {
    const ontologyNamespace = 'namespace';
    const ontologyId = 'ontology';
    const ontology: Ontology = {
      ontologyNamespace,
      ontologyId,
      name: 'Ontology',
      aliases: [],
    };
    await testOntologyStore.putOntology({ ontologyNamespace, ontologyId }, 'test-user', ontology);

    const response = await deleteOntologyHandler(
      {
        ontologyNamespace,
        ontologyId,
      },
      {
        userId: 'different-user',
        username: 'any',
        groups: [DefaultGroupIds.DEFAULT, DefaultGroupIds.ADMIN],
      },
    );
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(expect.objectContaining(ontology));
  });

  it('should delete any related attribute and attribute value policies', async () => {
    API.deleteGovernancePolicyAttributesGroup.mockResolvedValue({});
    API.deleteGovernancePolicyAttributeValuesGroup.mockResolvedValue({});

    const ontologyNamespace = 'namespace';
    const ontologyId = 'ontology';

    const namespaceAndAttributeId = buildNamespaceAndAttributeId(ontologyNamespace, ontologyId);

    const ontologyEntity = entityIdentifier('Ontology', { ontologyNamespace, ontologyId });
    await relationshipClient.addRelationships(DEFAULT_CALLER, ontologyEntity, [
      entityIdentifier('GovernancePolicyAttributesGroup', { namespaceAndAttributeId, group: 'admin' }),
      entityIdentifier('GovernancePolicyAttributeValuesGroup', { namespaceAndAttributeId, group: 'admin' }),
      entityIdentifier('GovernancePolicyAttributeValuesGroup', { namespaceAndAttributeId, group: 'sith' }),
    ]);

    const ontology: Ontology = {
      ontologyNamespace,
      ontologyId,
      name: 'Ontology',
      aliases: [],
    };
    await testOntologyStore.putOntology({ ontologyNamespace, ontologyId }, 'test-user', ontology);

    const response = await deleteOntologyHandler({
      ontologyNamespace,
      ontologyId,
    });
    expect(response.statusCode).toBe(200);

    const attributeId = ontologyId;
    expect(API.deleteGovernancePolicyAttributesGroup).toHaveBeenCalledTimes(1);
    expect(API.deleteGovernancePolicyAttributesGroup).toHaveBeenCalledWith({
      ontologyNamespace,
      attributeId,
      group: 'admin',
    });
    expect(API.deleteGovernancePolicyAttributeValuesGroup).toHaveBeenCalledTimes(2);
    expect(API.deleteGovernancePolicyAttributeValuesGroup).toHaveBeenCalledWith({
      ontologyNamespace,
      attributeId,
      group: 'admin',
    });
    expect(API.deleteGovernancePolicyAttributeValuesGroup).toHaveBeenCalledWith({
      ontologyNamespace,
      attributeId,
      group: 'sith',
    });

    expect(await relationshipClient.getRelatedEntities(ontologyEntity)).toHaveLength(0);
  });
});
