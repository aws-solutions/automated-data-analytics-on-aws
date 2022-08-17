/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition } from '../types'

export const AttributePolicy: StringEntityDefinition<'AttributePolicy'> = {
	AttributePolicy: 'Column Level Policy',
	AttributePolicies: 'Column Level Policies',
	attribute_policy: 'column level policy',
	attribute_policies: 'column level policies',

	description: 'Policy that defines column level governance applied to queries',
	descriptions: 'Set of column level governance policies applied to queries',
}

export default AttributePolicy;
