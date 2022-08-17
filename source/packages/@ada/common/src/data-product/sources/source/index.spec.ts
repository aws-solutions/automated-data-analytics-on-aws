/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { SouceDetailsSchema } from './index';

describe('common/data-product/source', () => {
  describe('SouceDetailsSchema', () => {
    it('should correctly merge all source details schemas as partials', () => {
      expect(SouceDetailsSchema).toMatchSnapshot();
    });
  });
});
