/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

export const parseStringTabularContent = (content: string): { [key: string]: string } => {
  return Object.fromEntries(
    content
      .split('\n')
      // skip lines with comments and information that are not relevant to the schema
      .filter((q) => !q.trim().startsWith('#') && q.split('\t').length >= 2)
      .map((curr) => {
        const parts = curr.split('\t');

        return [[parts[0].trim()], parts[1].trim()];
      }),
  );
};
