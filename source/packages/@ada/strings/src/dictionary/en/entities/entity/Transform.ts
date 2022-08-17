/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition } from '../types'

export const Transform: StringEntityDefinition<'Transform'> = {
	Transform: 'Data Product Transform',
	Transforms: 'Data Product Transforms',
	transform: 'transform',
	transforms: 'transforms',

	description: 'Transform script applied to a data product',
	descriptions: 'List of transform scripts applied to a data product',

	properties: {
		name: {
			label: 'Name',
			description: 'The unique name for this transform',
		},
		namespace: {
			label: 'Namespace',
			description: 'The domain the transform resides in',
		},
		description: {
			label: 'Description',
			description: 'The description of the tranform',
		},
		scriptContent: {
			label: 'Code',
			description: 'The python3 code that defines the function for this transform',
			hintText: 'Must have `def apply_transform(` function definition',
		}
	}
}

export default Transform;
