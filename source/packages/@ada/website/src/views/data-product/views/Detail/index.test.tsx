/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import * as stories from './index.stories';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { DataProductDetailView } from '.';
import { MockMetaProvider } from '$core/provider/mock';
import { Route } from 'react-router-dom';
import { act, fireEvent, render } from '@testing-library/react';
import { composeStories } from '@storybook/testing-react';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('@ada/api-client');

const { Primary, NotFound, Coverage } = composeStories(stories);

describe('DataProductDetailView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('storybook', () => {
    it('primary', async () => {
      const { container } = render(<Primary {...(Primary.args as any)} />);

      expect(container).toBeDefined();
    });

    it('not found', async () => {
      const { container, findByText } = render(<NotFound {...(NotFound.args as any)} />);

      expect(container).toBeDefined();

      expect(await findByText('Not found')).toBeInTheDocument();
    });

    it('coverage', async () => {
      const { container } = render(<Coverage {...(Coverage.args as any)} />);

      await act(async () => {
        await Coverage.play({ canvasElement: container });
      });

      expect(container).toBeDefined();
    });
  })

  // TODO: Re-enable when default lenses are added back
  it.skip('should edit and save default lenses', async () => {
    API.putDataProductDomainDataProduct.mockResolvedValue(fixtures.DATA_PRODUCT_WITH_ONE_DATASET);
    API.getDataProductDomainDataProduct.mockResolvedValue(fixtures.DATA_PRODUCT_WITH_ONE_DATASET);

    const { findAllByText, findByText } = render(
      <MockMetaProvider
        router={{ initialEntries: [`data-product/domain1/${fixtures.DATA_PRODUCT_WITH_ONE_DATASET.dataProductId}`] }}
      >
        <Route path="data-product/:domainId/:dataProductId">
          <DataProductDetailView />
        </Route>
      </MockMetaProvider>,
    );

    const defaultLenses = (await findAllByText('Default Lenses'))[0];
    await act(async () => {
      fireEvent.click(defaultLenses);
    });

    const editButton = await findByText('Edit Default Lenses');
    expect(editButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(editButton);
    });

    const saveButton = await findByText('Submit');
    expect(saveButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(API.putGovernancePolicyDefaultLensDomainDataProduct).toHaveBeenCalled();
  });
});
