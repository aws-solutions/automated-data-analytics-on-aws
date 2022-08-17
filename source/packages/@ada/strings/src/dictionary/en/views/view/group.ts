/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ENTITY } from '../../entities';

export const GROUP = {
	title: ENTITY.Groups,
	nav: ENTITY.Groups,

	HELP: {
		ROOT: {
			header: ENTITY.Groups,
		},
		DETAIL: {
			header: ENTITY.Group,
		},
		CREATE: {
			header: `Create ${ENTITY.Group}`,
		},
		UPDATE: {
			header: `Update ${ENTITY.Group}`,
		},
	},

	ROOT: {
		title: ENTITY.Groups,
		subtitle: 'View groups, request access and create new groups.',
	},

	NOT_FOUND_HTML: {
		description: `No ${ENTITY.group} found with name <i>{groupId:string|entityName}</i>`,
		seeAllLink: `See all ${ENTITY.groups}`,
	},

	AUTO_ASSIGN_USERS: {
		WARNING: {
			enabled: 'Enabling this will allow all signed in users to gain permissions of this group.',
			disabled: 'Disabling this will requiring manually adding all users to allow access.',
			members: 'All users have access to this group',
		},
		STATUS_HTML: {
			enabled: '<b>Enabled:</b> All users have access to this group',
			disabled: '<b>Disabled:</b> Users need to be explicitly added to this group',
		},
	},

	wizard: {
		title: `${ENTITY.Group} details`,
		description: 'Enter group details',

		review: {
			noMembers: `No ${ENTITY.members}`,
		},
	},

	AddMember: {
		buttonText: 'Add',
		notify: {
			error: 'Failed to add {member:string} to {group:string|entityName} group',
			success: 'Added {member:string} to {group:string|entityName} group',
		},
		input: {
			placeholder: 'Choose user to add to group...',
		},
	},

	BulkDialog: {
		title: 'Bulk users',
		description: 'Specificy large list of users',
		field: {
			users: {
				label: 'List of users',
				description: 'Enter or copy/paste list of users',
				hintText: 'Supports list separated by comma, semi-colon, and whitespace (space, tab, return)',
			},
		},
		ACTIONS: {
			cancel: {
				text: 'Cancel',
				label: 'Cancel bulk user update',
			},
			save: {
				text: 'Apply',
				label: 'Apply updates to the group',
			},
		}
	},

	AccessRequest: {
		ACTIONS: {
			sync: {
				text: 'Syncing',
				label: 'Click to force immediate syncronization',
			},
			join: {
				text: 'Join',
				label: 'Send request to join {group:string|entityName}',
			},
		},

		COLUMN: {
			createdBy: {
				header: 'Requested',
			},
			actions: {
				header: 'Actions',
			},
		},
		notify: {
			persistent: {
				header: `You have {0:number} pending ${ENTITY['access_requests$']}`,
				content: `View the ${ENTITY.groups} page to acknowledge ${ENTITY.access_requests}.`,
				buttonText: `View ${ENTITY.access_requests}`,
			},
			failed: 'Failed to {action:string} request for {userId:string}',
			send: {
				header: 'Join request sent',
				content: 'Successfully sent access request for {group:string|entityName} group. The group owner has been notified.',
				failed: 'Failed to send request to join {group:string|entityName}',
			}
		},
	},

	TABLES: {
		ACCESS_REQUEST: {
			title: ENTITY.AccessRequests,
			description: `Pending ${ENTITY.access_requests} for ${ENTITY.group} membership`,
		},
		MEMBER: {
			COLUMN: {
				id: {
					header: 'User Id',
				},
				name: {
					header: 'Name',
				},
			}
		},
		GROUP: {
			COLUMN: {
				status: {
					header: 'Status',
				}
			},
			DEFAULT: {
				title: `Default ${ENTITY.Groups}`,
				description: `${ENTITY.Groups} that are automatically created`,
			},
			CUSTOM: {
				title: `Custom ${ENTITY.Groups}`,
				description: `${ENTITY.Groups} that are created by ${ENTITY.users}`,
			},
		}
	}
} as const;
