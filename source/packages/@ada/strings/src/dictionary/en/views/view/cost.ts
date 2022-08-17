/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

const COST_EXPLORER = 'Cost Explorer';

export const COST = {
	title: COST_EXPLORER,
	nav: COST_EXPLORER,

	HELP: {
		ROOT: {
			header: COST_EXPLORER,
		},
	},

	AccountCosts: {
		label: 'Account Costs',
	},
	ServiceCosts: {
		label: 'Service Costs',
	}
} as const;
