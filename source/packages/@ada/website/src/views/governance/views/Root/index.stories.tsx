/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { AttributePolicy, LensEnum } from '@ada/api';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { DefaultGroupIds, LensIds } from '@ada/common';
import { LL } from '$strings'
import { NONE_LENS_OPTION } from '$common/entity/ontology';
import { OntologyRootView } from './index';
import { SYSTEM_USER } from '$common/entity/user';
import { TEST_USER } from '$common/entity/user/types';
import { act } from '@testing-library/react';
import { compact } from 'lodash';
import { delay } from '$common/utils';
import { selectOptionEvent } from '$testing/user-event';
import { useImmediateEffect } from '$common/hooks';
import { userEvent, waitFor, within } from '@storybook/testing-library';
import assert from 'assert';

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Views/Governance/Root',
  component: OntologyRootView,
  args: {
    onClose: jest.fn(),
  },
} as ComponentMeta<typeof OntologyRootView>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof OntologyRootView> = (args) => {
  useImmediateEffect(() => {
    API.listOntologies.mockResolvedValue({
      ontologies: [
        {
          ontologyNamespace: 'system',
          ontologyId: 'id_1',
          name: 'One',
          description: 'test 1',
          createdBy: SYSTEM_USER,
          defaultLens: LensIds.HASHED,
        },
        {
          ontologyNamespace: 'system',
          ontologyId: 'id_2',
          name: 'Two',
          description: 'test 2',
          createdBy: SYSTEM_USER,
          defaultLens: LensIds.HASHED,
        },
        {
          ontologyNamespace: 'custom',
          ontologyId: 'id_3',
          name: 'Three',
          description: 'test 3',
          createdBy: TEST_USER.id,
        },
        {
          ontologyNamespace: 'custom',
          ontologyId: 'id_4',
          name: 'Four',
          description: 'test 4',
          createdBy: TEST_USER.id,
        },
      ],
    });
    API.getGovernancePolicyAttributes.mockImplementation(({ group }) => {
      switch (group) {
        case DefaultGroupIds.DEFAULT: {
          return Promise.resolve({
            attributeIdToLensId: {
              'system.id_1': LensIds.HIDDEN,
              'custom.id_3': LensIds.HIDDEN,
            },
          });
        }
        case DefaultGroupIds.POWER_USER: {
          return Promise.resolve({
            attributeIdToLensId: {
              'system.id_1': LensIds.HASHED,
              'system.id_2': LensIds.HASHED,
            },
          });
        }
        case DefaultGroupIds.ADMIN: {
          return Promise.resolve({
            attributeIdToLensId: {
              'system.id_1': LensIds.CLEAR,
              'custom.id_3': LensIds.CLEAR,
            },
          });
        }
      }
      return Promise.resolve({ attributeIdToLensId: {} });
    });

    // introduce slight delay in mutations
    API.putGovernancePolicyAttributes.mockImplementation(async (): Promise<any> => {
      await delay(10);
    });
    API.deleteGovernancePolicyAttributes.mockImplementation(async (): Promise<any> => {
      await delay(10);
    });
  });

  return <OntologyRootView {...args} />;
};

export const Primary = Template.bind({});

export const Coverage = Template.bind({});

Coverage.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);

  await act(async () => {
    await delay(10);
    userEvent.click(await canvas.findByText(LL.VIEW.GOVERNANCE.actions.editGovernance()));
  });

  await delay(10);
  const edits: ([string, string] | [string, string, boolean])[] = [
    // default
    ['system.id_1:default', 'clear'],
    ['system.id_2:default', 'hashed'],
    ['custom.id_3:default', 'NONE'],
    ['custom.id_4:default', 'hidden'],
    // power
    ['system.id_1:power_user', 'clear'],
    ['system.id_2:power_user', 'hashed', true],
    ['custom.id_3:power_user', 'NONE', true],
    ['custom.id_4:power_user', 'hidden'],
    // admin
    ['system.id_1:admin', 'clear', true],
    ['system.id_2:admin', 'hashed'],
    ['custom.id_3:admin', 'NONE'],
    ['custom.id_4:admin', 'hidden'],
  ];
  for (const [selectLabel, optionValue] of edits) {
    await selectOptionEvent(canvasElement, selectLabel, optionValue);
  }

  // handle invalidation to refetch updated values
  API.getGovernancePolicyAttributes.mockImplementation(({ group }) => {
    return Promise.resolve({
      attributeIdToLensId: {
        ...Object.fromEntries(
          compact(
            edits.map(([key, lens]) => {
              const [id, groupId] = key.split(':');
              if (groupId !== group || lens === NONE_LENS_OPTION.value) return null;
              return [id, lens as LensIds];
            }),
          ),
        ),
      },
    });
  });

  await act(async () => {
    await delay(10);
    userEvent.click(await canvas.findByText('Save'));
  });

  assert.ok(await canvas.findByText(LL.ENTITY.Ontologies__CREATED_OR_UPDATED()));
  assert.ok(await canvas.findByText(LL.VIEW.GOVERNANCE.notify.updatedAndDeleted({
    updated: 7,
    deleted: 2,
  })));

  await waitFor(
    () => {
      assert.deepStrictEqual(
        API.putGovernancePolicyAttributes.mock.calls[0][0].putGovernancePolicyAttributesRequest.policies,
        compact(
          edits.map(([key, lensId, noop]): AttributePolicy | null => {
            const [namespaceAndAttributeId, group] = key.split(':');
            if (lensId === NONE_LENS_OPTION.value || noop === true) return null;
            return { group, namespaceAndAttributeId, lensId: lensId as LensEnum };
          }),
        ),
      );

      assert.deepStrictEqual(
        API.deleteGovernancePolicyAttributes.mock.calls[0][0].deleteGovernancePolicyAttributesRequest.policies,
        compact(
          edits.map(([key, lensId, noop]): Omit<AttributePolicy, 'lensId'> | null => {
            const [namespaceAndAttributeId, group] = key.split(':');
            if (lensId !== NONE_LENS_OPTION.value || noop === true) return null;
            return { group, namespaceAndAttributeId };
          }),
        ),
      );
    },
    {
      onTimeout: (error) => {
        throw error;
      },
    },
  );
};
