/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { parse as parseQueryString } from 'query-string';

const TRUTHY = /^(true|1|yes|y)$/i;

export function isTruthy(value?: any): boolean {
  if (value == null) return false;
  return TRUTHY.test(String(value));
}

export function queryFlags<T extends Record<string, boolean> | {}>(defaults: T, persist?: string): T {
  const flags = Object.entries({
    ...JSON.parse(persist ? window.localStorage?.getItem(persist) || '{}' : '{}'),
    ...parseQueryString(window.location.search),
  }).reduce(
    (_flags, [key, value]) => {
      return {
        ..._flags,
        [key]: value == null || value === '' || isTruthy(value),
      };
    },
    { ...defaults },
  );

  if (persist && window.localStorage) {
    window.localStorage.setItem(persist, JSON.stringify(flags));
  }

  return flags;
}
