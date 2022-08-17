/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { VError } from 'verror';
import type { EntityIdentifier } from '@ada/api/client/types';

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
    throw new VError(
      { name: 'EntityIdentifierError' },
      `The given entity identifier string is invalid, as it contains no identifier parts: ${identifier}`,
    );
  }
  return {
    type,
    identifierParts: identifierPartsString.split(IDENTIFIER_PARTS_SEPARATOR),
  };
};
