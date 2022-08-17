/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as _ from 'lodash';

/**
 * Find any keys of the first object where the value differs to that of the second object
 * @param a first object to check
 * @param b second object to check
 */
export const findKeysWithDifferentValues = (a: any, b: any): string[] =>
  _.reduce(a, (result, value, key) => (_.isEqual(value, b[key]) ? result : result.concat(key)), [] as string[]);
