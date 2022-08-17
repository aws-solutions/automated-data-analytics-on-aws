/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { initI18nReact } from 'typesafe-i18n/react'
import { loadedFormatters, loadedLocales } from './i18n-util'
import { useContext } from 'react'
// @ts-ignore - generated file
import type { Formatters, Locales, TranslationFunctions, Translations } from './i18n-types'
import type { I18nContextType } from 'typesafe-i18n/react'

const { component: TypesafeI18n, context: I18nContext } = initI18nReact<
	Locales, Translations, TranslationFunctions, Formatters
>(loadedLocales, loadedFormatters)

const useI18nContext = (): I18nContextType<Locales, Translations, TranslationFunctions> => useContext(I18nContext)

export { I18nContext, useI18nContext }

export default TypesafeI18n
