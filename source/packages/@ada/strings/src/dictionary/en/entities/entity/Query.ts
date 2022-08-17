/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition } from '../types'

export const Query: StringEntityDefinition<'Query'> = {
	Query: 'Query',
	Queries: 'Queries',
	query: 'query',
	queries: 'queries',

	description: 'SQL execution against managed data',
	descriptions: 'List of SQL executions against managed data',
}

export const Query_ = {
	download: 'Query download',
	execution: 'Query execution',
	result: 'Query result',
	schema: 'Query schema',
} as const;

export const SqlIdentifier = {
	label: 'SQL Identifier',
	description: 'Unique identifier used to reference a data set or a saved query',
	value: '{0:string|entityIdentifier}',
} as const;

export default Query;
