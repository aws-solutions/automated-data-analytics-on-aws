/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition } from '../types'

export const User: StringEntityDefinition<'User'> = {
	User: 'User',
	Users: 'Users',
	user: 'user',
	users: 'users',

	description: 'An unique user within the application',
	descriptions: 'List of users who have signed into the application',
}

export default User;
