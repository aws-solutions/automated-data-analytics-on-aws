/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition } from '../types'

export const Schema: StringEntityDefinition<'Schema'> = {
	Schema: 'Schema',
	Schemas: 'Schemas',
	schema: 'schema',
	schemas: 'schemas',

	description: 'Table field and type definition',
	descriptions: 'List of table field and type definitions',
}

export const Schema_ = {
	source: `Raw ${Schema.Schema}`,
	inferred: `Inferred ${Schema.Schema}`,
	transformed: `Processed ${Schema.Schema}`,
	preview: `${Schema.Schema} preview`,
} as const;

export default Schema;
