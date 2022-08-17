/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition } from '../types'

export const Machine: StringEntityDefinition<'Machine'> = {
	Machine: 'Machine',
	Machines: 'Machines',
	machine: 'machine',
	machines: 'machines',

	description: 'Unique client used to access the solution',
	descriptions: 'List of clients used to access the solution',
}

export default Machine;
