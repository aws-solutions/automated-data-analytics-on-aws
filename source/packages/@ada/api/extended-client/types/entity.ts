/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { GetEntityIdentifier, OperationEntityMeta, OperationEntityName, getEntityKeyFromParam } from './api-meta';

export interface EntityIdentifier {
  type: string;
  identifierParts: string[];
}

const TYPE_SEPARATOR = '::';
const IDENTIFIER_PARTS_SEPARATOR = ':';

/**
 * Convert an entity identifier to a string
 */
export const entityIdentifierToString = ({ type, identifierParts }: EntityIdentifier) =>
  `${type}${TYPE_SEPARATOR}${identifierParts.join(IDENTIFIER_PARTS_SEPARATOR)}`;

/**
 * Parse an entity identifier string
 */
export const entityIdentifierFromString = (identifier: string) => {
  const [type, identifierPartsString] = identifier.split(TYPE_SEPARATOR);
  if (!identifierPartsString) {
    throw new Error(`The given entity identifier string is invalid, as it contains no identifier parts: ${identifier}`);
  }
  return {
    type,
    identifierParts: identifierPartsString.split(IDENTIFIER_PARTS_SEPARATOR),
  };
};

/**
 * Create an entity identifier
 * @param type the type of entity to create
 * @param entity the entity which includes its id
 */
export const entityIdentifier = <K extends OperationEntityName>(
  type: K,
  entity: GetEntityIdentifier<K>,
): EntityIdentifier => ({
  type,
  identifierParts: getEntityKeyFromParam(OperationEntityMeta[type].entityKey, entity),
});

/**
 * Return the specific identifier type from an entity identifier
 * @param type the type of entity expected
 * @param entityIdentifierValue the entity identifier
 */
export const identifierFromEntityIdentifier = <K extends OperationEntityName>(
  type: K,
  entityIdentifierValue: EntityIdentifier,
): GetEntityIdentifier<K> => {
  const entityKey = OperationEntityMeta[type].entityKey;
  if (type !== entityIdentifierValue.type) {
    throw new Error(`Provided type ${type} must match entity type ${entityIdentifierValue.type}`);
  }
  return Object.fromEntries(
    entityKey.map((key, i) => [key, entityIdentifierValue.identifierParts[i]]),
  ) as unknown as GetEntityIdentifier<K>;
};
