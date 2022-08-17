/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition } from '../types'

export const Member: StringEntityDefinition<'Member'> = {
	Member: 'Member',
	Members: 'Members',
	member: 'member',
	members: 'members',

	description: 'Individual user belonging to a group',
	descriptions: 'List of users that belong to a group',
}

export default Member;
