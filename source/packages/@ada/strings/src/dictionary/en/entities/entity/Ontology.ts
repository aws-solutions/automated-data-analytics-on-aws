/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Lens } from './Lens';
import type { StringEntityDefinition } from '../types'

export const Ontology: StringEntityDefinition<'Ontology'> = {
	Ontology: 'Governance Attribute',
	Ontologies: 'Governance Attributes',
	ontology: 'attribute',
	ontologies: 'attributes',

	description: 'Business term used to apply governance across all data',
	descriptions: 'List of business terms used to apply governance across all data',

	properties: {
		namespace: {
      label: 'Namespace',
      description: 'The category used to classify the attribute',
      hintText: 'Example: personal, business, sales'
    },
    name: {
      label: 'Name',
      description: 'The name of the attribute',
    },
    description: {
      label: 'Description',
      description: 'The description of the attribute',
    },
    aliases: {
      label: 'Aliases',
      description: 'Additional names used for this attribute',
    },
    defaultLens: {
      label: `Default ${Lens.Lens}`,
      description: `The default ${Lens.lens} to apply when group governance is not defined`,
    },
	}
}

export const Ontology_ = {
	Alias: 'Alias',
	Aliases: 'Aliases',
	alias: 'alias',
	aliases: 'aliases',
} as const;

export default Ontology;
