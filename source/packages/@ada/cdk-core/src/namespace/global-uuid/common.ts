/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as crypto from 'crypto';

export interface Properties {
  // Existing UUID from "Create" used during "Update" and "Delete" to persist value
  uuid?: string;
}

export interface Data {
  uuid: string;
}

// used to convert construct.node.path to 4 digit hash
export const get4DigitsHash = (value: string, salt = 'salt'): string => {
  const hmac = crypto.createHmac('sha256', Buffer.from(salt, 'hex'));
  const hexChars = hmac.update(value).digest('hex').slice(0, 4);
  const digitsHash = (parseInt(hexChars, 16) % 10000).toString();
  return (
    Array(4 - digitsHash.length)
      .fill(0)
      .join('') + digitsHash
  );
};

/**
 * Returns a "friendly hash" with the first part of the returned string being a substring of the given value, followed
 * by a 4 digit hash
 */
export const getFriendlyHash = (value: string, substringLength = 6) =>
  `${value.substring(0, substringLength)}${get4DigitsHash(value)}`;
