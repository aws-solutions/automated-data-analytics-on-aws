/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { DefaultGroupIds } from '@ada/common';
import { MockMetaProvider } from '$core/provider/mock';
import { OntologyDetailView } from '.';
import { OntologyEntity } from '@ada/api';
import { Route } from 'react-router-dom';
/* eslint-disable-next-line */
import { RequestError } from '$api/client/__mocks__';
import { act, render } from '@testing-library/react';
import { startCase } from 'lodash';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('@ada/api-client');

const mockOntology: OntologyEntity = {
  ontologyNamespace: 'ontologyNamespace',
  ontologyId: 'ontologyId',
  description: 'ontology description',
  name: 'ontology name',
  aliases: [{ name: 'alias1' }, { name: 'alias2' }],
  createdBy: 'creator',
  createdTimestamp: '2021-01-01T00:00:00Z',
  updatedBy: 'updater',
  updatedTimestamp: '2021-01-01T00:00:01Z',
};

describe('OntologyDetailView', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    API.getOntology.mockResolvedValue(mockOntology);

    API.listIdentityGroups.mockResolvedValue({
      groups: [
        { groupId: DefaultGroupIds.ADMIN, claims: [], members: [], apiAccessPolicyIds: [] },
        { groupId: DefaultGroupIds.POWER_USER, claims: [], members: [], apiAccessPolicyIds: [] },
        { groupId: DefaultGroupIds.DEFAULT, claims: [], members: [], apiAccessPolicyIds: [] },
      ],
    });
    API.getGovernancePolicyAttributeValues.mockResolvedValueOnce({
      attributeIdToSqlClause: {
        'ontologyNamespace.ontologyId': '"ontologyNamespace.ontologyId" LIKE "% Vader"',
      },
    });
    API.getGovernancePolicyAttributeValues.mockResolvedValueOnce({
      attributeIdToSqlClause: {
        'ontologyNamespace.ontologyId': '"ontologyNamespace.ontologyId" LIKE "Luke %"',
      },
    });
    API.getGovernancePolicyAttributeValues.mockResolvedValueOnce({
      attributeIdToSqlClause: {},
    });
  });

  it('should show the ontology details', async () => {
    await act(async () => {
      const { findByText } = render(
        <MockMetaProvider router={{ initialEntries: ['ontologies/ontologyNamespace.ontology1'] }}>
          <Route path="ontologies/:ontologyId">
            <OntologyDetailView />
          </Route>
        </MockMetaProvider>,
      );
      expect(await findByText(startCase(mockOntology.ontologyNamespace))).toBeInTheDocument();
      expect(await findByText(mockOntology.description as string)).toBeInTheDocument();
      expect(await findByText(mockOntology.name)).toBeInTheDocument();
      expect(await findByText(mockOntology.aliases[0].name)).toBeInTheDocument();
      expect(await findByText(mockOntology.aliases[1].name)).toBeInTheDocument();
      // expect(await findByText(mockOntology.createdBy as string)).toBeInTheDocument();
      // expect(await findByText(mockOntology.updatedBy as string)).toBeInTheDocument();
      expect(await findByText('Edit')).toBeInTheDocument();
    });
  });

  it('should show an error when the ontology does not exist', async () => {
    API.getOntology.mockImplementation(() => {
      throw new RequestError('Ontology not found!', {
        message: 'Ontology not found!',
      });
    });

    await act(async () => {
      const { findByText } = render(
        <MockMetaProvider router={{ initialEntries: ['ontologies/ontologyNamespace.ontology1'] }}>
          <Route path="ontologies/:ontologyId">
            <OntologyDetailView />
          </Route>
        </MockMetaProvider>,
      );

      expect(await findByText('Ontology not found!')).toBeInTheDocument();
    });
  });
});
