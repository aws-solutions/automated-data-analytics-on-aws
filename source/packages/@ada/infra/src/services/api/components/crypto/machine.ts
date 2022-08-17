/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SALT_ROUNDS = 8;

/**
 * generate an hash for the input string
 * @param input the string to be hashed
 * @returns the hashed result
 */
export const hash = (input: string): Promise<string> => bcrypt.hash(input, SALT_ROUNDS);

/**
 * Compare a input in clear text with the hashed string provided.
 * @param input input in clear text
 * @param hashed the hash to be compared with
 * @returns true if the input (after being hashed) is equal to the hashed string provided
 */
export const compareHash = (input: string, hashed: string): Promise<boolean> => bcrypt.compare(input, hashed);

/**
 * Generate a random 256 bytes random secret
 * @returns the random secret string
 */
export const generateSecret = (): Promise<string> =>
  new Promise((resolve, reject) =>
    crypto.randomBytes(256, (err, buff) => {
      if (err) {
        return reject(err);
      }

      return resolve(buff.toString('hex'));
    }),
  );
