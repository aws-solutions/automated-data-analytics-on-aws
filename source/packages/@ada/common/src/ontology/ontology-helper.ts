/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
/**
 * Build an an ontology attribute with namespace
 */
export const buildNamespaceAndAttributeId = (ontologyNamespace: string, attributeId: string): string => {
  return `${ontologyNamespace}.${attributeId}`;
};

/**
 * Build an unique ontology identifier
 */
export const buildUniqOntology = (
  namespaceAndAttributeId: string,
): { ontologyNamespace: string; ontologyId: string } => {
  return {
    ontologyNamespace: namespaceAndAttributeId.split('.')[0],
    ontologyId: namespaceAndAttributeId.split('.')[1],
  };
};

/**
 * Build an unique ontology with attributeId identifier
 */
export const buildUniqAttribute = (
  namespaceAndAttributeId: string,
): { ontologyNamespace: string; attributeId: string } => {
  return {
    ontologyNamespace: namespaceAndAttributeId.split('.')[0],
    attributeId: namespaceAndAttributeId.split('.')[1],
  };
};
