/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import * as stories from './index.stories';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { DefaultGroupIds, LensIds } from '@ada/common';
import {
  DeleteGovernancePolicyAttributeValuesGroupRequest,
  DeleteGovernancePolicyAttributesGroupRequest,
  PutGovernancePolicyAttributeValuesGroupRequest,
  PutGovernancePolicyAttributesGroupRequest,
  PutOntologyRequest,
} from '@ada/api';
import { LL } from '@ada/strings';
import { act, render } from '@testing-library/react';
import { composeStories } from '@storybook/testing-react';
import { delay } from '$common/utils';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('@ada/api-client');

const { Primary, Coverage } = composeStories(stories);

const CUSTOM_ONTOLOGY = fixtures.ONTOLOGY_CUSTOM_NAME;

describe('views/goverance/update', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('primary', async () => {
    const { container } = render(<Primary {...(Primary.args as any)} />);

    expect(container).toBeDefined();
  });
  it('coverage', async () => {
    const { container, findByText } = render(<Coverage {...(Coverage.args as any)} />);

    await act(async () => {
      await delay(10);
    });

    await act(async () => {
      await Coverage.play({ canvasElement: container });
    });

    await act(async () => {
      await delay(100);
    });

    // notification
    await expect(findByText(LL.ENTITY.Ontology__UPDATED('Name'))).resolves.toEqual(expect.anything());

    // entity
    expect(API.putOntology).toHaveBeenCalledTimes(1);
    expect(API.putOntology).toHaveBeenCalledWith(
      expect.objectContaining({
        ontologyNamespace: CUSTOM_ONTOLOGY.ontologyNamespace,
        ontologyId: CUSTOM_ONTOLOGY.ontologyId,
        ontologyInput: expect.objectContaining({
          defaultLens: LensIds.HASHED,
          description: 'Updated description',
          updatedTimestamp: CUSTOM_ONTOLOGY.updatedTimestamp,
        }),
      } as PutOntologyRequest),
      undefined,
    );

    // column policy
    expect(API.putGovernancePolicyAttributesGroup).toHaveBeenCalledTimes(1);
    expect(API.putGovernancePolicyAttributesGroup).toHaveBeenCalledWith(
      {
        group: DefaultGroupIds.POWER_USER,
        ontologyNamespace: CUSTOM_ONTOLOGY.ontologyNamespace,
        attributeId: CUSTOM_ONTOLOGY.ontologyId,
        attributePolicyInput: {
          lensId: 'clear',
          updatedTimestamp: fixtures.ENTITY_CRUD.updatedTimestamp,
        },
      } as PutGovernancePolicyAttributesGroupRequest,
      undefined,
    );

    expect(API.deleteGovernancePolicyAttributesGroup).toHaveBeenCalledTimes(1);
    expect(API.deleteGovernancePolicyAttributesGroup).toHaveBeenCalledWith(
      {
        group: DefaultGroupIds.DEFAULT,
        ontologyNamespace: CUSTOM_ONTOLOGY.ontologyNamespace,
        attributeId: CUSTOM_ONTOLOGY.ontologyId,
      } as DeleteGovernancePolicyAttributesGroupRequest,
      undefined,
    );

    // row policy
    expect(API.putGovernancePolicyAttributeValuesGroup).toHaveBeenCalledTimes(1);
    expect(API.putGovernancePolicyAttributeValuesGroup).toHaveBeenCalledWith(
      {
        group: DefaultGroupIds.DEFAULT,
        attributeId: CUSTOM_ONTOLOGY.ontologyId,
        ontologyNamespace: CUSTOM_ONTOLOGY.ontologyNamespace,
        attributeValuePolicyInput: {
          sqlClause: 'foo > 5',
          updatedTimestamp: fixtures.ENTITY_CRUD.updatedTimestamp,
        },
      } as PutGovernancePolicyAttributeValuesGroupRequest,
      undefined,
    );

    expect(API.deleteGovernancePolicyAttributeValuesGroup).toHaveBeenCalledTimes(1);
    expect(API.deleteGovernancePolicyAttributeValuesGroup).toHaveBeenCalledWith(
      {
        group: DefaultGroupIds.POWER_USER,
        attributeId: CUSTOM_ONTOLOGY.ontologyId,
        ontologyNamespace: CUSTOM_ONTOLOGY.ontologyNamespace,
      } as DeleteGovernancePolicyAttributeValuesGroupRequest,
      undefined,
    );
  }, 20000);
});
