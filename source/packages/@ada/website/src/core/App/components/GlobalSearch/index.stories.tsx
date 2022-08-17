/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { DELAY } from '$testing/interaction';
import { GlobalSearch } from './index';
import { OperationKeys } from '@ada/api-client/mock';
import { SavedQueryEntity } from '@ada/api';
import { act } from '@testing-library/react';
import { delay, getDataProductSQLIdentitier, getOntologyIdString } from '$common/utils';
import { normalizeEntity } from '$core/provider/IndexingProvider/entity-store';
import { useImmediateEffect } from '$common/hooks';
import { useIndexingContext } from '$core/provider/IndexingProvider';
import { userEvent } from '@storybook/testing-library';

export default {
  title: 'App/GlobalSearch',
  component: GlobalSearch,
  args: {
    onClose: jest.fn(),
  },
  parameters: {
    providers: {
      // wrap story with IndexingProvider for auto completion
      indexing: true,
    },
  },
} as ComponentMeta<typeof GlobalSearch>;

function applyTestTag (entity: any) {
  return {
    ...entity,
    tags: [...entity.tags || [], { key: 'test' }]
  }
}

const Template: ComponentStory<typeof GlobalSearch> = (args) => {
  const { setEntity } = useIndexingContext();

  useImmediateEffect(() => {
    fixtures.DOMAINS.forEach((entity) => {
      setEntity(
        normalizeEntity('DataProductDomain' as OperationKeys,
        entity.domainId,
        applyTestTag(entity))
      );
    });
    fixtures.DATA_PRODUCTS.forEach((entity) => {
      setEntity(
        normalizeEntity('DataProductDomainDataProduct' as OperationKeys,
        getDataProductSQLIdentitier(entity),
        applyTestTag(entity))
      );
    });
    fixtures.GROUPS.forEach((entity) => {
      setEntity(
        normalizeEntity('IdentityGroup' as OperationKeys,
        entity.groupId,
        applyTestTag(entity)
      ));
    });
    fixtures.ONTOLOGIES.forEach((entity) => {
      setEntity(
        normalizeEntity('Ontology' as OperationKeys,
        getOntologyIdString(entity),
        applyTestTag(entity)
      ));
    });

    setEntity(
      normalizeEntity('QueryNamespaceSavedQuery',
      'test.query1',
      applyTestTag({
        namespace: 'test',
        queryId: 'query1',
        addressedAs: 'test.queries.query1',
        description: 'Test description',
        type: 'PUBLIC',
      } as Partial<SavedQueryEntity>)
    ));
    setEntity(
      normalizeEntity('QuerySavedQuery',
      'user.query1',
      applyTestTag({
        namespace: 'my',
        queryId: 'query2',
        addressedAs: 'my.queries.query2',
        description: 'Test description',
        type: 'PRIVATE',
      } as Partial<SavedQueryEntity>)
    ));

    setEntity(normalizeEntity('NotSupported', 'not_supported', {}));
  });

  return <GlobalSearch {...args} />;
};

export const Primary = Template.bind({});

export const Coverage = Template.bind({});

Coverage.play = async ({ canvasElement }) => {
  await act(async () => {
    await delay(DELAY.SHORT)
  })

  const searchInput = canvasElement.querySelector('input[type="search"]') as HTMLInputElement;
  await act(async () => {
    userEvent.click(searchInput);
  })
  await act(async () => {
    await userEvent.type(searchInput, 'test', { delay: DELAY.TYPING });
  })
};
