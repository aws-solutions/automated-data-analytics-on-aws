/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as stories from './index.stories';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { ApiError } from '@ada/api';
import { CreateDataProductView } from '../index';
import { LL } from '@ada/strings';
import { MockMetaProvider } from '$core/provider/mock';
import { Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import { composeStories } from '@storybook/testing-react';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('@ada/api-client');

const { Primary } = composeStories(stories);

describe('CreateDataProductView', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    API.listDataProductScripts.mockResolvedValue({
      scripts: [
        { namespace: 'global', scriptId: 'script-1', name: 'First Script', source: 'scriptContents' } as any,
        { namespace: 'global', scriptId: 'script-2', name: 'Second Script', source: 'scriptContents' } as any,
      ],
    });
    API.listIdentityGroups.mockResolvedValue({
      groups: [{ groupId: 'group-1' }, { groupId: 'group-2' }],
    });
    API.listDataProductDomains.mockResolvedValue({
      domains: [{ domainId: 'domain-1', name: 'Domain One' }],
    });
  });

  describe('storybook', () => {
    it('primary', async () => {
      const { container, findAllByText } = render(<Primary {...(Primary.args as any)} />);

      expect(container).toBeDefined();

      expect((await findAllByText(LL.ENTITY.DataProduct__CREATE())).length).toBeGreaterThan(0);
    });
  })

  it('should show an error when we fail to fetch groups', async () => {
    API.listIdentityGroups.mockRejectedValue({
      message: 'Groups not found!',
    } as ApiError);

    const { findByText } = render(
      <MockMetaProvider appLayout router={{ initialEntries: ['data-product/domain1/new'] }}>
        <Route path="data-product/:domainId/new">
          <CreateDataProductView />
        </Route>
      </MockMetaProvider>,
    );

    expect(await findByText('Groups not found!')).toBeInTheDocument();
  });

  it('should show an error when we fail to fetch scripts', async () => {
    API.listDataProductScripts.mockRejectedValue({
      message: 'Scripts not found!',
    } as ApiError);

    const { findByText } = render(
      <MockMetaProvider appLayout router={{ initialEntries: ['data-product/domain1/new'] }}>
        <Route path="data-product/:domainId/new">
          <CreateDataProductView />
        </Route>
      </MockMetaProvider>,
    );

    expect(await findByText('Scripts not found!')).toBeInTheDocument();
  });
});
