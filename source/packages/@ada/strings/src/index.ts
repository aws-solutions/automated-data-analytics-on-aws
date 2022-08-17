/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DotNotation } from './util-types';
import { EntityKey, EntityKeys } from './dictionary/en/entities/types';
import { Get } from 'type-fest';
import { Translations } from './i18n/i18n-types';
import { get } from 'lodash';
import { i18n, i18nObject } from './i18n/i18n-util';
import { loadAllLocales } from './i18n/i18n-util.sync';
import type { LocalizedString } from 'typesafe-i18n';

/* eslint-disable max-len */

export {
	LocalizedString,
	EntityKey,
	EntityKeys,
}

loadAllLocales();

export const L = i18n();

export const LL = i18nObject('en');

export type LLDotKeys = DotNotation<Translations>;

export type LLDotFunctions = {
	[K in LLDotKeys]: Get<typeof LL, K>;
}

export type LLDotArgs<K extends LLDotKeys> = Parameters<Get<typeof LL, K>>;

export type LLSafeHtmlDotKeys = Exclude<
	LLDotKeys,
	Exclude<LLDotKeys, `${string}${'HTML' | 'Html' | 'html'}${string | ''}`>
>;


export function getLocalizedStringFunction <K extends LLDotKeys>(_LL: typeof LL, dotKey: K): Get<typeof LL, K> {
	return get(_LL, dotKey);
}

export function getLLStringFunction <K extends LLDotKeys>(dotKey: K): Get<typeof LL, K> {
	return getLocalizedStringFunction(LL, dotKey);
}
