/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { OWNER } from '../../constants'
import { StringEntityProperties } from '../types'

export const COMMON = {
	...{
		createdBy: {
			label: OWNER,
			description: 'Created by user',
		},
	} as StringEntityProperties,
}
