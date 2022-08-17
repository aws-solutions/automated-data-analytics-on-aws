/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { ColumnMetadata, DataProductEntity, OntologyIdentifier } from '@ada/api';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { LL } from '@ada/strings';
import { NONE_ONTOLOGY_OPTION } from './components/column-definitions';
import { SchemaRenderer } from './index';
import { act } from '@testing-library/react';
import { apiHooks } from '$api';
import { cloneDeep, last } from 'lodash';
import { delay, getOntologyIdString } from '$common/utils';
import { selectOptionEvent } from '$testing/user-event';
import { useImmediateEffect } from '$common/hooks';
import { useRef } from 'react';
import { userEvent, waitFor, within } from '@storybook/testing-library';
import assert from 'assert';

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Views/DataProduct/components/SchemaRenderer',
  component: SchemaRenderer,
  args: {
    onClose: jest.fn(),
  },
} as ComponentMeta<typeof SchemaRenderer>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof SchemaRenderer> = (args) => {
  const entityRef = useRef<DataProductEntity>();
  const refetchCount = useRef(0);

  useImmediateEffect(() => {
    API.listOntologies.mockResolvedValue({ ontologies: fixtures.ONTOLOGIES });
    API.listIdentityGroups.mockResolvedValue({ groups: fixtures.GROUPS });
    API.getDataProductDomainDataProduct.mockImplementation(() => {
      entityRef.current = fixtures.DATA_PRODUCT;
      return Promise.resolve(entityRef.current);
    });
    API.putDataProductDomainDataProduct.mockImplementation(async ({ dataProductInput }) => {
      await delay(10);

      entityRef.current = {
        ...entityRef.current!,
        ...dataProductInput,
      };
      return entityRef.current;
    });
  });

  const [entity] = apiHooks.useDataProductDomainDataProduct(fixtures.DATA_PRODUCT, {
    // force updating the entity to ensure updates do not block the UI while editing
    refetchInterval: () => {
      refetchCount.current += 1;
      if (refetchCount.current > 2) {
        return false;
      }
      return 10;
    },
    staleTime: 9,
  });

  if (entity == null) return <>Loading</>;

  return <SchemaRenderer {...args} entity={entity} />;
};

export const Primary = Template.bind({});

export const Coverage = Template.bind({});

Coverage.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);

  for (const [dataSetId, dataSet] of Object.entries(fixtures.DATA_PRODUCT.dataSets!)) {
    await act(async () => {
      await delay(10);
    });

    const tableTab = canvasElement.querySelector(`[role="button"][title="${dataSetId}"]`)!;

    await act(async () => {
      userEvent.click(tableTab);
    });

    await act(async () => {
      await delay(10);
      userEvent.click(await canvas.findByText(LL.VIEW.DATA_PRODUCT.SCHEMA.ACTION.edit.text()));
    });

    const updated: Record<string, ColumnMetadata> = cloneDeep(dataSet.columnMetadata);

    for (const [columnName, meta] of Object.entries(updated)) {
      await act(async () => {
        await delay(10);
        const ontology = mapColumnOntology(columnName);
        const ontologyId = ontology && getOntologyIdString(ontology);
        await selectOptionEvent(
          canvasElement,
          LL.VIEW.DATA_PRODUCT.SCHEMA.COLUMN.ontology.named(columnName),
          ontologyId || NONE_ONTOLOGY_OPTION.value!,
        );
        if (ontology) {
          Object.assign(meta, {
            ontologyNamespace: ontology.ontologyNamespace,
            ontologyAttributeId: ontology.ontologyId,
          });
        } else {
          delete meta.ontologyNamespace;
          delete meta.ontologyAttributeId;
        }
      });

      await delay(10);
      const description = `The ${columnName.toUpperCase()}`;
      meta.description = description;
      const input = canvas.getByPlaceholderText(LL.VIEW.DATA_PRODUCT.SCHEMA.COLUMN.description.placeholder({columnName}));
      await userEvent.type(input, description, { delay: 2 });
      await delay(10);
    }

    await act(async () => {
      await delay(10);
    });

    await act(async () => {
      userEvent.click(await canvas.findByText(LL.VIEW.DATA_PRODUCT.SCHEMA.ACTION.save.text()));
    });

    await act(async () => {
      await delay(100);
    });

    await waitFor(
      () => {
        assert.deepStrictEqual(
          last(API.putDataProductDomainDataProduct.mock.calls)![0].dataProductInput.dataSets![dataSetId].columnMetadata,
          updated,
        );
      },
      {
        timeout: 100,
        onTimeout: (error) => {
          throw error;
        },
      },
    );

    await act(async () => {
      await delay(100);
    });
  }
};

function mapColumnOntology(columnName: string): OntologyIdentifier | undefined {
  return fixtures.ONTOLOGIES.find((ontology) => {
    if (ontology.name.toLowerCase() === columnName.toLowerCase()) return true;
    return ontology.aliases.find(({ name }) => name.toLowerCase() === columnName.toLowerCase()) != null;
  });
}
