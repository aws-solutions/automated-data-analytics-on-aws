/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { api } from '../client';
import { generateApiHooks } from './generator';

export * from './generator';

export const apiHooks = generateApiHooks(api);

export default apiHooks;
