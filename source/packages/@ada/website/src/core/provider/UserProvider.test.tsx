/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AmplifyContext, MOCK_AMPLIFY_CONTEXT } from './AmplifyProvider';
import { ApiProvider } from './ApiProvider';
import { Auth } from '@aws-amplify/auth';
import { EntityCacheEventEmitter } from '$api';
import { GroupEntity } from '@ada/api';
import { TEST_COGNITO_USER, federatedUserToUserProfile } from '$common/entity/user';
import { UserProvider, useUserContext } from './UserProvider';
import { act, render, waitFor } from '@testing-library/react';
import { delay } from '$common/utils';

jest.mock('$api/route-permissions', () => ({
	useUserPermissionsProvider: () => ({
		refetchPermissions: jest.fn(),
	})
}))

describe('core/provider/UserProvider', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should render provider', async () => {
		const currentAuthenticatedUser = jest.spyOn(Auth, 'currentAuthenticatedUser')
		currentAuthenticatedUser.mockImplementation(() => Promise.resolve(TEST_COGNITO_USER));
		const federatedSignIn = jest.spyOn(Auth, 'federatedSignIn')
		federatedSignIn.mockImplementation(jest.fn())

		const refreshToken = jest.fn();

		const Tester = () => {
			const context = useUserContext();

			return <pre>{JSON.stringify(context.userProfile)}</pre>
		}
    const { container } = render(
			<ApiProvider>
				<AmplifyContext.Provider value={{ ...MOCK_AMPLIFY_CONTEXT, refreshToken }}>
					<UserProvider>
						<Tester />
					</UserProvider>
				</AmplifyContext.Provider>
			</ApiProvider>
		);

		await act(async () => delay(100));

    expect(container.innerHTML).toMatch(JSON.stringify(federatedUserToUserProfile(TEST_COGNITO_USER as any)));

		act(() => {
			EntityCacheEventEmitter.emit('entity.SET', 'IdentityGroup', 'mock-group-id', {
				groupId: 'mock-group-id',
				autoAssignUsers: false,
				members: [TEST_COGNITO_USER.attributes!.preferred_username!],
			} as Partial<GroupEntity>);
		})

		await waitFor(async () => {
			expect(refreshToken).toBeCalled();
			await act(async () => delay(100));
		})

  });
});
