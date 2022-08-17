/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { detectLocale as detectLocaleFn } from 'typesafe-i18n/detectors'
import { i18n as initI18n, i18nObject as initI18nObject, i18nString as initI18nString } from 'typesafe-i18n'
import type { LocaleDetector } from 'typesafe-i18n/detectors'
// @ts-ingore - generated file
import type { Formatters, Locales, TranslationFunctions, Translations } from './i18n-types'

export const baseLocale: Locales = 'en'

export const locales: Locales[] = [
	'en'
]

export const loadedLocales = {} as Record<Locales, Translations>

export const loadedFormatters = {} as Record<Locales, Formatters>

export const i18nString = (locale: Locales) => initI18nString<Locales, Formatters>(locale, loadedFormatters[locale])

export const i18nObject = (locale: Locales) =>
	initI18nObject<Locales, Translations, TranslationFunctions, Formatters>(
		locale,
		loadedLocales[locale],
		loadedFormatters[locale]
	)

export const i18n = () => initI18n<
	Locales, Translations, TranslationFunctions, Formatters
>(loadedLocales, loadedFormatters)

export const detectLocale = (...detectors: LocaleDetector[]) => {
	return detectLocaleFn<Locales>(baseLocale, locales, ...detectors);
}
