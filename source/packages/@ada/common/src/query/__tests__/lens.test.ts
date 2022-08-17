/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  LensIds,
  PRIMITIVE_TYPES,
  UdfHash,
  compareLensRestrictiveness,
  getLeastRestrictiveLens,
  getUdfsForLens,
} from '../lens';

describe('lens', () => {
  it('should compare lens restrictiveness', () => {
    expect(Object.values(LensIds).sort(compareLensRestrictiveness)).toEqual([
      LensIds.CLEAR,
      LensIds.HASHED,
      LensIds.REDACT_PII,
      LensIds.HIDDEN,
    ]);
  });

  it('should get the least restrictive lens', () => {
    expect(getLeastRestrictiveLens(LensIds.CLEAR, LensIds.HIDDEN)).toEqual(LensIds.CLEAR);
    expect(getLeastRestrictiveLens(LensIds.HIDDEN, LensIds.CLEAR)).toEqual(LensIds.CLEAR);
    expect(getLeastRestrictiveLens(LensIds.HASHED, LensIds.HIDDEN)).toEqual(LensIds.HASHED);
    expect(getLeastRestrictiveLens(LensIds.HIDDEN, LensIds.HASHED)).toEqual(LensIds.HASHED);
  });

  it('should return the udfs to apply for a lens', () => {
    expect(getUdfsForLens(LensIds.HASHED)).toEqual([UdfHash]);
    expect(getUdfsForLens(LensIds.HASHED, 'string')).toEqual([UdfHash]);
    expect(getUdfsForLens(LensIds.HASHED, 'varchar')).toEqual([UdfHash]);
    expect(getUdfsForLens(LensIds.HASHED, 'array<string>')).toEqual([]);
    expect(getUdfsForLens(LensIds.HIDDEN)).toEqual([]);
    expect(getUdfsForLens(undefined as unknown as LensIds)).toEqual([]);
  });

  it.each([...Array.from(PRIMITIVE_TYPES)])('should apply the hashed lens for primitive type %s', (dataType) => {
    expect(getUdfsForLens(LensIds.HASHED, dataType)).toEqual([UdfHash]);
  });
});
