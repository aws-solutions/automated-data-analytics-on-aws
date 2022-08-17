/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition } from '../types'

export const UserProfile: StringEntityDefinition<'UserProfile'> = {
	UserProfile: 'User Profile',
	UserProfiles: 'User Profiles',
	user_profile: 'profile',
	user_profiles: 'profiles',

	description: 'Specific profile for a given user',
	descriptions: 'List of profiles for users',

	properties: {
		id: {
      label: 'Username',
      description: 'Unique id of the user',
    },
    name: {
      label: 'Name',
      description: 'Name of the user',
    },
    email: {
      label: 'Email',
      description: 'Email address of the user',
    },
    groups: {
      label: 'User Groups',
      description: 'Groups which this user is a member',
    },
	}
}

export default UserProfile;
