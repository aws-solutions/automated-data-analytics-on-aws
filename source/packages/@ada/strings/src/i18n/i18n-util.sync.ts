/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { initFormatters } from './formatters'
import { loadedFormatters, loadedLocales, locales } from './i18n-util'
// @ts-ingore - generated file
import type { Locales, Translations } from './i18n-types'

import en from './en'

const localeTranslations = {
	en,
}

export const loadLocale = (locale: Locales): void => {
	if (loadedLocales[locale]) return

	loadedLocales[locale] = localeTranslations[locale] as unknown as Translations
	loadFormatters(locale)
}

export const loadAllLocales = (): void => locales.forEach(loadLocale)

export const loadFormatters = (locale: Locales): void => {
	loadedFormatters[locale] = initFormatters(locale)
}
