/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { LL, LLDotArgs, LLSafeHtmlDotKeys, LocalizedString, getLocalizedStringFunction } from '@ada/strings';
import { getDataEqualityHash } from '$common/utils';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useMemo } from 'react';

/* eslint-disable sonarjs/no-identical-functions */

function resolveString(_LL: typeof LL, string: LLSafeHtmlDotKeys, args: any[] = []): LocalizedString {
  const _fn = getLocalizedStringFunction(_LL, string) as Function;
  // typesafe-i18n LocalizeString function during prod build requires exact matching of expected args,
  // make spread arg result in empty values. To prevent this rather than using spread we need to
  // explicit call the fn with inline args. Tried to resolve with apply/call of fn but similar issue occured.
  switch (args.length) {
    case 0: return _fn();
    case 1: return _fn(args[0]);
    case 2: return _fn(args[0], args[1]);
    case 3: return _fn(args[0], args[1], args[2]);
    case 4: return _fn(args[0], args[1], args[2], args[3]);
    default: return _fn(...args);
  }
}

/**
 * Span component with inner html rendered from allowed safe html localized strings.
 *
 * Only dictionary keys containing `HTML | Html | html` somewhere in their path are allowed.
 */
export function LLSafeHtmlString <K extends LLSafeHtmlDotKeys>(
  { string, args }: Extract<LLDotArgs<K>, undefined> extends undefined
    ? { string: K, args?: LLDotArgs<K> }
    : { string: K, args: LLDotArgs<K> }
) {
  const { LL: _LL } = useI18nContext();

  const __html = useMemo<string>(() => {
    return resolveString(_LL, string, args);
  }, [string, getDataEqualityHash(args)]);

  return <span dangerouslySetInnerHTML={{ __html }} />
}

/**
 * Div component with inner html rendered from allowed safe html localized strings.
 *
 * Only dictionary keys containing `HTML | Html | html` somewhere in their path are allowed.
 */
export function LLSafeHtmlBlock <K extends LLSafeHtmlDotKeys>(
  { string, args }: Extract<LLDotArgs<K>, undefined> extends undefined
    ? { string: K, args?: LLDotArgs<K> }
    : { string: K, args: LLDotArgs<K> }
) {
  const { LL: _LL } = useI18nContext();

  const __html = useMemo<string>(() => {
    return resolveString(_LL, string, args);
  }, [string, getDataEqualityHash(args)]);

  return <div dangerouslySetInnerHTML={{ __html }} />
}
