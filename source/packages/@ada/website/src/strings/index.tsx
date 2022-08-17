/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ENV_DEVELOPMENT } from '$config';
import { EntityKey, L, LL } from '@ada/strings';
import { loadAllLocales } from '@ada/strings/dist/i18n/i18n-util.sync';
import I18nProvider, { I18nContext, useI18nContext } from '@ada/strings/dist/i18n/i18n-react';

export * from './safe-html';

export {
  I18nContext,
  I18nProvider,
  useI18nContext,
  EntityKey as EntityString,
  L,
  LL,
}

export type TStringEntityEventKey = keyof {
  [P in keyof typeof LL.ENTITY as P extends `${EntityKey}__${string}` ? P : never]: true;
};

export function isStringEntityEventKey (value: string): value is TStringEntityEventKey {
  return (value in LL.ENTITY);
}

export function asStringEntityEventKey (value: string): TStringEntityEventKey {
  if (isStringEntityEventKey(value)) return value;

  throw new Error(`Value is not key of LL.ENTITY: "${value}"`)
}

declare global {
  interface Window {
    STRINGS: {
      L: typeof L;
      LL: typeof LL;
    }
  }
}

// enable hot reloading during development when string values change in dictionary
if (ENV_DEVELOPMENT) {
  loadAllLocales();

  // expose the raw string interplotion utils for debugging
  window.STRINGS = { L, LL };
}
