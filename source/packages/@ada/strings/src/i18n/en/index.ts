/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { cloneDeepWith, omit } from 'lodash'
import en_dictionary from '../../dictionary/en';
import type { BaseTranslation } from 'typesafe-i18n'

function cleanDictionary (dictionary: any): any {
	return cloneDeepWith(dictionary, (value): any => {
		if (typeof value === 'object' && '__esModule' in value) {
			return cleanDictionary(omit(value, ['__esModule']))
		}
	})
}

const en: BaseTranslation = cleanDictionary(en_dictionary);

export default en
