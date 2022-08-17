/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition } from '../types'

export const Lens: StringEntityDefinition<'Lens'> = {
	Lens: 'Lens',
	Lenses: 'Lenses',
	lens: 'lens',
	lenses: 'lenses',

	description: 'Defines governance function applied to queried data',
	descriptions: 'List of available governance functions',
}

export const Lens_ = {
	default: `Default ${Lens.Lens}`,
} as const;

export default Lens;
