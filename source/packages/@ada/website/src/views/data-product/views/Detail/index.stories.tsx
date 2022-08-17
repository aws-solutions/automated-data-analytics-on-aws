/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { DataProductAccess, DefaultGroupIds } from '@ada/common';
import { DataProductDetailView } from '.';
import { DataProductEntity } from '@ada/api';
import { LL } from '@ada/strings';
import { MemoryRouter, Route } from 'react-router-dom';
import { act } from '@testing-library/react';
import { delay } from '$common/utils';
import { useImmediateEffect } from '$common/hooks';
import { useRef } from 'react';
import { userEvent, waitFor, within } from '@storybook/testing-library';

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Views/DataProduct/Detail',
  component: DataProductDetailView,
  parameters: {
    notFound: false,
  },
} as ComponentMeta<typeof DataProductDetailView>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof DataProductDetailView> = (args, context) => {
  const notFound = context.parameters.notFound === true;
  const { domainId, dataProductId } = notFound
    ? { domainId: 'missing', dataProductId: 'not_existing' }
    : fixtures.DATA_PRODUCT;
  const entityRef = useRef<DataProductEntity>();

  useImmediateEffect(() => {
    API.getDataProductDomainDataProduct.mockImplementation(() => {
      if (notFound) {
        return Promise.reject(new Error('Data Product not found!'));
      }
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
    API.getGovernancePolicyDomainDataProduct.mockResolvedValue({
      domainId: fixtures.DATA_PRODUCT.domainId,
      dataProductId: fixtures.DATA_PRODUCT.dataProductId,
      permissions: {
        [DefaultGroupIds.DEFAULT]: { access: DataProductAccess.READ_ONLY },
        [DefaultGroupIds.POWER_USER]: { access: DataProductAccess.FULL },
      }
    })
  });

  return (
    <MemoryRouter initialEntries={[`/data-product/${domainId}/${dataProductId}`]}>
      <Route path="/data-product/:domainId/:dataProductId">
        <DataProductDetailView {...args} />
      </Route>
    </MemoryRouter>
  );
};

export const Primary = Template.bind({});

export const NotFound = Template.bind({});

NotFound.parameters = {
  notFound: true,
};


export const Coverage = Template.bind({});

Coverage.play = async ({ canvasElement }) => {
  const { getByText, findByText } = within(canvasElement);

  // ensure state is fully resolved
  await act(async () => {
    await delay(10);
  });

  const permissionsTab = getByText(LL.VIEW.DATA_PRODUCT.PERMISSIONS.title(), { selector: 'button span' });
  await act(async () => {
    userEvent.click(permissionsTab);
  });

  const editButton = await findByText(LL.VIEW.DATA_PRODUCT.PERMISSIONS.editButton.text());
  await act(async () => {
    userEvent.click(editButton);
  });

  await act(async () => {
    userEvent.click(getByText('Submit'));
  });

  await waitFor(() => {
    expect(API.putGovernancePolicyDomainDataProduct).toHaveBeenCalled();
  })
};
