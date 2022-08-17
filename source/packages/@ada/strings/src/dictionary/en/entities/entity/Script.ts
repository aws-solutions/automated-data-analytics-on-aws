/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition } from '../types'

export const Script: StringEntityDefinition<'Script'> = {
	Script: 'Transform Script',
	Scripts: 'Transform Scripts',
	script: 'script',
	scripts: 'scripts',

	description: 'Python function used to apply transforms on imported data',
	descriptions: 'List of python functions used to apply tranforms on imported data',
}

export default Script;
