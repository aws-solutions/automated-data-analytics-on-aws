/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataSetIds } from '@ada/common';
import { sortDataSetIds } from '../data-product';

describe('utils/data-product', () => {
  it('should sort dataset ids', () => {
    expect(sortDataSetIds(['zzzzzz', 'aaaaaa', 'bbbbbb'])).toEqual(['aaaaaa', 'bbbbbb', 'zzzzzz']);

    expect(sortDataSetIds(['zzzzzz', 'aaaaaa', 'bbbbbb', DataSetIds.DEFAULT])).toEqual([
      DataSetIds.DEFAULT,
      'aaaaaa',
      'bbbbbb',
      'zzzzzz',
    ]);
  });
});
