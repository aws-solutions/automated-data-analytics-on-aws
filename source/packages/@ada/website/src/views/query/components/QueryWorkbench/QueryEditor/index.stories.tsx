/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { OperationKeys } from '@ada/api/client/types';
import { QueryEditor } from './index';
import { QueryWorkbenchProvider, useQueryWorkbench } from '../context';
import { act } from '@testing-library/react';
import { delay, getDataProductSQLIdentitier } from '$common/utils';
import { findSQLEditor } from '$testing/sql-editor';
import { normalizeEntity } from '$core/provider/IndexingProvider/entity-store';
import { useEffect } from 'react';
import { useImmediateEffect } from '$common/hooks';
import { useIndexingContext } from '$core/provider/IndexingProvider';

const BASE_QUERY = 'SELECT * FROM ';

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Views/QueryWorkbench/components/QueryEditor',
  component: QueryEditor,
  args: {},
  parameters: {
    providers: {
      // wrap story with IndexingProvider for auto completion
      indexing: true,
      custom: (({ children }) => <QueryWorkbenchProvider>{children}</QueryWorkbenchProvider>) as React.FC,
    },
  },
} as ComponentMeta<typeof QueryEditor>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof QueryEditor> = (args) => {
  const { setEntity } = useIndexingContext();
  const { setQuery } = useQueryWorkbench();

  useImmediateEffect(() => {
    fixtures.DATA_PRODUCTS.forEach((dp) => {
      setEntity(normalizeEntity('DataProductDomainDataProduct' as OperationKeys, getDataProductSQLIdentitier(dp), dp));
    });
  });

  useEffect(() => {
    setQuery(BASE_QUERY);
  }, []);

  return <QueryEditor {...args} />;
};

export const Primary = Template.bind({});

export const Autocompletion = Template.bind({});

Autocompletion.play = async ({ canvasElement }) => {
  await act(async () => {
    await delay(10);
  });

  const sqlEditor = await findSQLEditor(canvasElement);

  await sqlEditor.append('domain');

  await delay(10);

  await sqlEditor.clickCompletion('domain1.the_data_product.dataSet2');

  await delay(10);

  expect(sqlEditor.value).toBe(`${BASE_QUERY}domain1.the_data_product.dataSet2`);
};
