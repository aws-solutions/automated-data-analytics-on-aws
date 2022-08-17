/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

export const action = {
	cancel: {
		text: 'Cancel {0?:string}',
		label: 'Cancel {0?:string}',
	},
	save: {
		text: 'Save {0?:string}',
		label: 'Save {0?:string}',
	},
	edit: {
		text: 'Edit {0?:string}',
		label: 'Edit {0?:string}',
	},
	delete: {
		text: 'Delete {0?:string}',
		label: 'Delete {0?:string}',
	},
	copyToClipboard: {
		text: 'Copy to clipboard',
		label: 'Copy to clipboard',
	},
	deleteEntity: {
		title: 'Delete {entityType:string} "{entityName:string}"',
		confirmationText: 'delete',
		buttonText: 'Delete',
		HTML: {
			confirmationLabel: 'To confirm deletion, type <i>{confirmationText:string}</i> below',
			warning: `This will <b>permanently</b> delete {entityType:string} <i>{entityName:string}</i>
			<br/>If other entities depend on this {entityType:string} the delete will fail and you will need to delete those entities first.`,
		}
	},
} as const;

export const notify = {
	Notification: {
		single: 'Notification',
		multiple: 'Notifications',
		count: '{0:number} notification{{s|}}',
		dismissAll: {
			title: 'Dismiss notifications',
			message: 'Permenantly dismiss {0:number} notifications?',
			buttonText: 'Dismiss all',
			confirmButtonText: 'Dismiss',
		}
	},
	error: {
		fetch: 'Failed to fetch {0?:string|quote}',
		create: 'Failed to create {entity:string} {name?:string|quote}',
		update: 'Failed to update {entity:string} {name?:string|quote}',
		createOrUpdate: 'Failed to save {entity:string} {name?:string|quote}',
		delete: 'Failed to delete {entity:string} {name?:string|quote}',
		load: 'Failed to get {entity:string} {name?:string|quote}',
	},
	success: {
		create: 'Created {entity:string} {name?:string|quote}',
		update: 'Updated {entity:string} {name?:string|quote}',
		createOrUpdate: 'Saved {entity:string} {name?:string|quote}',
		delete: 'Deleted {entity:string} {name?:string|quote}',
	},
	brief: {
		ignoreSave: {
			header: 'Save ignored',
			content: 'Nothing changed to be saved',
		},
		clipboard: {
			success: 'Copied to clipboard!',
		},
	},
} as const;

export const error = {
	unknownError: 'Something went wrong',
	notFound: 'Not found',
	notFoundOf: '{type:string} not found.',
	notfoundOfWithName: '{type:string} not found for {name:string}',
	failedToFetch: 'Failed to load.',
	failedToFetchDetailed: 'Failed to load - {details?:string}.',
} as const;

export const loading = {
	Loading: 'Loading...',
	Processing: 'Processing...',
} as const;

export const misc = {
	all: 'all',
	All: 'All',
	seeAll: 'See all {0?:string}',
	Retry: 'Retry',
	retry: 'retry',
	references: 'references',
	References: 'References',
} as const;

export const wizard = {
	STEP: {
		review: {
			title: 'Review',
		}
	}
}
