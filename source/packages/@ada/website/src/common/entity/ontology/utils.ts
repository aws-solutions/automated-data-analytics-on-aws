/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { LensEnum, Ontology, OntologyEntity, OntologyIdentifier, PutOntologyRequest } from '@ada/api';
import { OntologyNamespace } from '@ada/common';
import { SelectOption } from 'aws-northstar/components/Select';
import { groupBy, isString, sortBy, startCase, uniq, upperCase } from 'lodash';

export const mapOntologyAttributesFromFormData = (ontology: any): PutOntologyRequest => ({
  ontologyId: ontology.ontologyId,
  ontologyNamespace: ontology.ontologyNamespace,
  ontologyInput: {
    ...ontology,
    aliases: ontology.aliases ? uniq(ontology.aliases) : [],
  },
});

export function ontologyDisplayName(ontology: OntologyIdentifier | string): string {
  let id = isString(ontology) ? ontology : getOntologyIdString(ontology);
  id = id.replace(OntologyNamespace.PII_CLASSIFICATIONS, 'PII');
  return startCase(id);
}

export function getOntologyIdString(ontology: OntologyIdentifier): string {
  return `${ontology.ontologyNamespace}.${ontology.ontologyId}`;
}

export function getOntologyIdFromString(id: string): OntologyIdentifier {
  const [ontologyNamespace, ontologyId] = id.split('.');
  return { ontologyNamespace, ontologyId };
}

export function findOntologyById<T extends Ontology[] | OntologyEntity[]>(
  id: string,
  ontologies: T,
): (T extends OntologyEntity[] ? OntologyEntity : Ontology) | undefined {
  return ontologies.find((ontology) => getOntologyIdString(ontology) === id);
}

export function getGroupedOntologySelectionOptions(ontologies: Ontology[]): SelectOption[] {
  return sortBy(
    Object.entries(groupBy(ontologies, 'ontologyNamespace')).reduce((groups, [namespace, _ontologies]) => {
      const options: SelectOption[] = _ontologies.map((ontology) => ({
        label: ontology.name,
        value: getOntologyIdString(ontology),
      }));
      const group: SelectOption = { label: namespace, options };
      return groups.concat(group);
    }, [] as SelectOption[]),
    'label',
  );
}

export function ontologyLensDisplay(lens?: LensEnum, defaultValue?: LensEnum): string {
  if (lens == null) {
    return upperCase((defaultValue || 'clear') + '*');
  }
  return upperCase(lens);
}
