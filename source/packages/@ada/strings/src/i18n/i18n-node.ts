/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { i18n } from './i18n-util'
import { loadAllLocales } from './i18n-util.sync'

loadAllLocales()

export const L = i18n()

export default L
