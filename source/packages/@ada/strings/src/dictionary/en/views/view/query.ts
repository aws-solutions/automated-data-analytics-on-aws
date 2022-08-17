/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ENTITY } from '../../entities';
import { QUERY_WORKBENCH } from '../../constants';
import { StringEntityProperty } from '../../entities/types';

export const QUERY = {
	title: QUERY_WORKBENCH,
	nav: QUERY_WORKBENCH,
	subtitle: 'Query data from your data products',

	HELP: {
		ROOT: {
			header: QUERY_WORKBENCH,
		},
	},

	STATUS: {
		CANCELLED: {
			label: 'Query was canceled',
		},
		FAILED: {
			label: 'Failed to execute query',
		},
		TIMED_OUT: {
			label: 'Query timed out',
			hintText: 'Please evaluate your query and retry',
		},
	},

	ACTIONS: {
		cancel: {
			text: 'Cancel',
			label: 'Cancel the query execution',
		},
		execute: {
			text: 'Execute',
			label: 'Execute the query',
		},
		save: {
			text: 'Save',
			label: 'Save the current query',
		},
		export: {
			text: 'Export',
			label: 'Export the current query results as csv file',
		}
	},

	DATA_INTEGRITY: {
		stale: {
			label: 'Stale',
		},
	},

	RESULTS: {
		title: 'Query Results',
		emptyText: 'Enter a query above to view results',

		EXPORT: {
			failed: {
				label: 'Failed to export query results',
			},
		}
	},

	SAVED_QUERY: {
		shared: {
			label: 'Shared',
			description: `Share the ${ENTITY.saved_query} with other ${ENTITY.users} through a ${ENTITY.domain}`,
		} as StringEntityProperty,

		domain: {
			label: ENTITY.Domain,
			description: `Choose the ${ENTITY.domain} in which the query will be shared`,
		} as StringEntityProperty,

		emptyText: 'No saved queries',

		PRIVATE: {
			title: 'My Queries',
			subtitle: 'my.queries.*',
			type: {
				label: 'Private',
			},
		},
		PUBLIC: {
			title: 'Shared Queries',
			subtitle: '<domain>.queries.*',
			type: {
				label: 'Shared',
			}
		},
	},

	SQL_COMPLETION: {
		TYPE: {
			column: 'Column',
			allColumns: 'All columns',
			spreadColumns: 'Spread columns',
		}
	}
} as const;
