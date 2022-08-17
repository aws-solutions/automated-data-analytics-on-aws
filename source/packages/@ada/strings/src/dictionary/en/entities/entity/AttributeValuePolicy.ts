/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { StringEntityDefinition } from '../types'

export const AttributeValuePolicy: StringEntityDefinition<'AttributeValuePolicy'> = {
	AttributeValuePolicy: 'Row Level Policy',
	AttributeValuePolicies: 'Row Level Policies',
	attribute_value_policy: 'row level policy',
	attribute_value_policies: 'row level policies',

	description: 'Policy that defines row level governance applied to queries',
	descriptions: 'Set of row level governance policies applied to queries',
}

export default AttributeValuePolicy;
