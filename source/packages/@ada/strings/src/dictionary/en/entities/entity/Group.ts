/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition } from '../types'

export const Group: StringEntityDefinition<'Group'> = {
	Group: 'Group',
	Groups: 'Groups',
	group: 'group',
	groups: 'groups',

	description: 'Set of users with specific permissions and governance',
	descriptions: 'List of groups for defining user permissions and governance',

	properties: {
		groupId: {
      label: 'Name',
      description: 'Display name for the group',
      placeholder: 'Enter unique name for this group...',
    },
    description: {
      label: 'Description',
      description: 'Summary of the group to specify purpose',
      placeholder: 'Enter description...',
    },
    autoAssignUsers: {
      label: 'Auto Assign Users',
      description: 'This group can be a catch all group to simplify basic access for all users',
      hintText: 'Give all users that sign in, access to this group',
    },
    members: {
      label: 'Members',
      description: 'List of usernames for members of this group',
      hintText:
        'Choose active user from list or enter any username into the field above. Use "Bulk" to enter a large list of users.',
      emptyText: 'No members',
    },
    accessPolicies: {
      label: 'Access Level',
      description: 'List of access policies for this group',
      hintText: 'Choose access policies from list or enter any access policy into the field above',
      emptyText: 'No access policies',
    },
	}
}

export default Group;
