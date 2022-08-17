/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { startCase } from 'lodash';

export function nameToIdentifier(name: string): string {
  return (name || '')
    .replace(/([A-Z]+)/g, ' $1')
    .trim()
    .replace(/[^a-z0-9]+/gi, '_')
    .toLowerCase();
}

export function identifierToName(identifier: string): string {
  // capitalize every word and squish <= 2 char parts
  // "Ap Southeast 1 Z 680 Q As Bb Auth 0" => "ApSoutheast1Z680QAsBbAuth0"
  // https://regexr.com/6b4i4
  return startCase(identifier).replace(/(?:\b|\s)(\w{1,2})(?:\s|\b)/g, '$1');
}
