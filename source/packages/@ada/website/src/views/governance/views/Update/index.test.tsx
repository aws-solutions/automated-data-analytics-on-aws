/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import * as stories from './index.stories';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { DELAY } from '$testing/interaction';
import { DefaultGroupIds, LensIds } from '@ada/common';
import { LL } from '@ada/strings';
import {
  PutOntologyRequest,
} from '@ada/api';
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
      await delay(DELAY.SHORT);
    });

    await act(async () => {
      await Coverage.play({ canvasElement: container });
    });

    await act(async () => {
      await delay(DELAY.SHORT);
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
    expect(API.putGovernancePolicyAttributes).toHaveBeenCalledTimes(1);
    expect(API.putGovernancePolicyAttributes).toHaveBeenCalledWith(
      {
        putGovernancePolicyAttributesRequest: {
          policies: [
            {
              group: DefaultGroupIds.POWER_USER,
              lensId: 'clear',
              namespaceAndAttributeId: `${CUSTOM_ONTOLOGY.ontologyNamespace}.${CUSTOM_ONTOLOGY.ontologyId}`,
            },
            {
              group: DefaultGroupIds.ADMIN,
              lensId: 'clear',
              namespaceAndAttributeId: `${CUSTOM_ONTOLOGY.ontologyNamespace}.${CUSTOM_ONTOLOGY.ontologyId}`,
            }
          ]
        }
      },
      undefined
    );

    // row policy
    expect(API.putGovernancePolicyAttributeValues).toHaveBeenCalledTimes(1);
    expect(API.putGovernancePolicyAttributeValues).toHaveBeenCalledWith({
      putGovernancePolicyAttributeValuesRequest: {
          policies: [
            {
              group: DefaultGroupIds.DEFAULT,
              namespaceAndAttributeId: `${CUSTOM_ONTOLOGY.ontologyNamespace}.${CUSTOM_ONTOLOGY.ontologyId}`,
              sqlClause: 'foo > 5',
            },
          ]
        },
      },
      undefined,
    );

  }, 40000);
});
