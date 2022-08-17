/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { camelCase, kebabCase, padEnd, snakeCase, startCase } from 'lodash';
import type { FormattersInitializer } from 'typesafe-i18n'
// @ts-ingore - generated file
import { Formatters, Locales } from './i18n-types';

export const initFormatters: FormattersInitializer<Locales, Formatters> = (_locale: Locales) => {
	const formatters: Formatters = {
		quote: (value) => value ? `"${value}"` : '',

		mask: () => padEnd('', 10, '*'),

		mask5: (value) => padEnd(String(value || '').substring(0, 6), 10, '*'),

		lowercase: (value) => String(value).toLowerCase(),

		uppercase: (value) => String(value).toUpperCase(),

		startcase: startCase,

		kebabcase: kebabCase,

		snakecase: snakeCase,

		camelcase: camelCase,

		entityIdentifier: (value) => snakeCase(value as string).replace(/_(\w)(?:_|\b)/g, '$1'),

		entityName: (value) => startCase(value as string).replace(/(?:\b|\s)(\w{1,2})(?:\s|\b)/g, '$1'),
	}

	return formatters
}
