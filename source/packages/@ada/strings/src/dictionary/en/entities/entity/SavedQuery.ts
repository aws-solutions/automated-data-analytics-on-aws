/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition } from '../types'

export const SavedQuery: StringEntityDefinition<'SavedQuery'> = {
	SavedQuery: 'Saved Query',
	SavedQueries: 'Saved Queries',
	saved_query: 'saved query',
	saved_queries: 'saved queries',

	description: 'Reusable query that can be shared and referenced in other queries',
	descriptions: 'List of reusable queries that can be shared and referenced in other queries',

	properties: {
		name: {
			label: 'Name',
			description: 'A unique name for the query',
			hintText: 'Must start with a letter and only contain letters and numbers',
		},
		description: {
			label: 'Description',
			description: 'A summary of what the query is doing'
		},
		tags: {
			label: 'Tags',
			description: 'Tags to associate with this saved query',
		},
	}
}

export default SavedQuery;
