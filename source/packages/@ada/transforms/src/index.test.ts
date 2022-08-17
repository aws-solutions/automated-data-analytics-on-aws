/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as index from './index';

describe('transforms', () => {
  it('should compile transforms', () => {
    // There are no functions within this package yet, so simply importing and verify no errors is enough for coverage.
    expect(index.BuiltInTransforms).toBeDefined();
    expect(index.TransformFields).toBeDefined();
    expect(index.TransformWidgets).toBeDefined();
  });
});
