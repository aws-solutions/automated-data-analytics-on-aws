/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { App } from './index';
import { LL } from '$strings';
import { MockMetaProvider } from '$core/provider/mock';
import { render } from '@testing-library/react';
import { useHasNoAccess, useIsAdmin, useIsRootAdmin } from '../provider/UserProvider';

jest.mock('../provider/UserProvider', () => ({
  ...jest.requireActual('../provider/UserProvider'),
  useHasNoAccess: jest.fn(() => false),
  useIsAdmin: jest.fn(() => false),
  useIsRootAdmin: jest.fn(() => false),
}));

jest.mock('../../views/public', () => ({
  Router: () => 'PUBLIC ROUTER',
}));

describe('core/App', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should render app with default settings', () => {
    const { container, queryByText } = render(<MockMetaProvider><App /></MockMetaProvider>);

    expect(container).toBeDefined();

    expect(queryByText(LL.VIEW.ADMIN.nav())).toBeNull();
  });

  it('should force users with no access to public landing page', () => {
    (useHasNoAccess as jest.MockedFunction<typeof useHasNoAccess>).mockImplementation(() => true);
    const { container, queryByText } = render(<MockMetaProvider><App /></MockMetaProvider>);

    expect(container).toBeDefined();

    expect(queryByText('PUBLIC ROUTER')).toBeDefined();
  });

  it('should render app with admin nav for admin user', () => {
    (useIsAdmin as jest.MockedFunction<typeof useIsAdmin>).mockImplementation(() => true);
    const { container, queryByText } = render(<MockMetaProvider><App /></MockMetaProvider>);

    expect(container).toBeDefined();

    expect(queryByText(LL.VIEW.ADMIN.nav())).toBeDefined();
  });

  it('should render app with root admin nav for root admin user', () => {
    (useIsAdmin as jest.MockedFunction<typeof useIsAdmin>).mockImplementation(() => true);
    (useIsRootAdmin as jest.MockedFunction<typeof useIsRootAdmin>).mockImplementation(() => true);
    const { container, queryByText } = render(<MockMetaProvider><App /></MockMetaProvider>);

    expect(container).toBeDefined();

    expect(queryByText(LL.VIEW.ADMIN.Teardown.nav())).toBeDefined();
  });
});
