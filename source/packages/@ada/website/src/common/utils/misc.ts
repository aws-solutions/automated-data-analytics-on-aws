/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import safeStringify from 'safe-stable-stringify';

export function getDataEqualityHash(value: any): string {
  return safeStringify(value);
}
export function isDataEqual(a: any, b: any): boolean {
  if (typeof a !== typeof b) return false;
  return getDataEqualityHash(a) === getDataEqualityHash(b);
}

export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
