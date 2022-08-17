/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { useMemo } from 'react';

type Placeholder<T, TDefault> = {
  [P in keyof T]: T[P] | TDefault;
};

/**
 * [Experimental] Hook to create a proxy around objects to enable "grey box placeholders" for UI layouts during loading.
 * @param value
 * @param defaultPlaceholder
 * @param placeholders
 * @returns
 */
export function usePlaceholder<T, TDefault, TPlaceholders extends Partial<NonNullable<T>>>(
  value: T,
  defaultPlaceholder: TDefault,
  placeholders?: TPlaceholders,
): [NonNullable<T> | Placeholder<NonNullable<T>, TDefault>, boolean] {
  return useMemo(() => {
    if (value != null) return [value, false];

    const proxy = new Proxy(
      {},
      {
        get: (_target: any, prop) => {
          if (placeholders && prop in placeholders) {
            return placeholders[prop as keyof TPlaceholders];
          }
          return defaultPlaceholder;
        },
      },
    );
    return [proxy, true];
  }, [value, defaultPlaceholder, placeholders]) as any;
}
