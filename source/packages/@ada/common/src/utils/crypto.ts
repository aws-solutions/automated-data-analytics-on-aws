/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as crypto from 'crypto';

/**
 * Hash the input using the SHA256 algorithm
 * @param input the input to be hashed
 * @returns the hash string in hex format
 */
export const computeUniqueHash = (input: string) => crypto.createHash('sha256').update(input).digest('hex');
