/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ENTITY } from '../../entities';

export const GOVERNANCE = {
	title: 'Governance',
	nav: 'Governance',
	subtitle: 'Define the business dictionary and apply governances across all your data',

	HELP: {
		ROOT: {
			header: 'Governance',
		},
		DETAIL: {
			header: ENTITY.Ontology,
		},
		CREATE: {
			header: `Create ${ENTITY.Ontology}`,
		},
		UPDATE: {
			header: `Update ${ENTITY.Ontology}`,
		},
	},

	notify: {
		updatedAndDeleted: `Updated {updated:number} and deleted {deleted:number} ${ENTITY.ontologies}`
	},

	ERROR: {
		reservedNamespace: `Must not be reserved namespace: {0:string}`,
	},

	tables: {
		astriksPolicyDisclaimer: 'Attribute policies marked with asteriks (*) are default values and not explicitly defined for group',
		OntologyWithAttributePolicies: {
			title: ENTITY.Ontologies,
			description: `${ENTITY.Ontologies} and the ${ENTITY.Lenses} that should be applied`,
		},
	},

	actions: {
		editGovernance: 'Edit Governance',
		addOntolgoy: `Add ${ENTITY.Ontology}`,
		searchGroups: `find ${ENTITY.group} and add governance settings for the group`,
		addGovernanceForGroup: 'Add Governance Settings'
	},

	summary: {
		title: 'Details',

		section: {
			defaultGovernance: {
				title: 'Default Governance',
				subtitle: 'Default governance settings for when group specific policies are not applied',
			},
			groupGovernance: {
				title: '{group:string} Governance',
				subtitle: 'Governance applied to {group:string} group',
			},
		},
	},

	wizard: {
		step: {
			details: {
				title: 'Attribute Details',
				description: `General details about this ${ENTITY.ontology}`,
			},
			governance: {
				title: 'Governance',
				description: `Governance applied to this specific ${ENTITY.ontology}`,
			},
		},

		groupGovernance: {
			description: 'Governance applied to group',
		},

		alert: {
			systemEntity: `System ${ENTITY.ontology} details can not be modified, only governance can be updated.`,
		},
	},

	Alias: {
		add: 'Add Alias',
		enter: 'Enter Alias',
	},
} as const;
