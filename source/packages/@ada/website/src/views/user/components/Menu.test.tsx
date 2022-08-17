/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { LoggedUserMenu } from './Menu';
import { MockMetaProvider } from '$core/provider/MetaProvider/mock';
import { Suspense } from 'react';
import { TEST_USER } from '$common/entity/user';
import { act, render } from '@testing-library/react';

jest.mock('aws-amplify');
jest.mock('@ada/api-client');

describe('User/Menu', () => {
  it('should show the menu for the logged user and fallback to the username if no attributes are defined', async () => {
    await act(async () => {
      const { findByText } = render(
        <Suspense fallback={<></>}>
          <MockMetaProvider>
            <LoggedUserMenu />
          </MockMetaProvider>
        </Suspense>,
      );
      expect(await findByText(TEST_USER.name!)).toBeInTheDocument();
    });
  });
});
