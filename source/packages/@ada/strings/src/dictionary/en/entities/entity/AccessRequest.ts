/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Group } from './Group'
import { User } from './User'
import type { StringEntityDefinition } from '../types'

export const AccessRequest: StringEntityDefinition<'AccessRequest'> = {
	AccessRequest: 'Access Request',
	AccessRequests: 'Access Requests',
	access_request: 'request',
	access_requests: 'requests',

	description: `Request from ${User.user} to join a ${Group.group}`,
	descriptions: `List of requests from ${User.users} to join ${Group.groups}`,

	properties: {
		userId: {
			label: 'User',
			description: 'The user requesting access',
		},
		groupId: {
			label: 'Group',
			description: 'The group access being requested',
		},
	}
}

export default AccessRequest;

export const AccessRequest_ = {
	pending: {
		label: 'Pending',
		description: 'Access request has been recieved and awaiting action from owner',
	},

	notify: {
		header: 'Group {0:string|entityName} access notification',
		received: 'Access request has been receieved'
	},

	ACTIONS: {
		requestorMessage: 'User {requestor:string} has requested to join the {group:string|entityName} group',
		APPROVE: {
			label: 'Approve',
			description: 'Approve this access request',
			message: 'User {requestee:string} has approved access to the {group:string|entityName} group for {requestor:string}',
		},
		DENY: {
			label: 'Deny',
			description: 'Deny this access request',
			message: 'User {requestee:string} has denied access to the {group:string|entityName} group for {requestor:string}',
		},
	}
} as const;
