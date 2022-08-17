/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { findKeysWithDifferentValues } from '../object';

describe('object', () => {
  it('should find any keys of the first object where the value differs to that of the second', () => {
    const objectA = {
      a: 10,
      b: 'test',
      c: {
        d: 'd',
      },
    };
    const objectB = {
      a: 10,
      b: 'different value',
      c: {
        d: 'd',
        e: 'e',
      },
    };

    expect(findKeysWithDifferentValues(objectA, objectB)).toEqual(['b', 'c']);
  });
});
