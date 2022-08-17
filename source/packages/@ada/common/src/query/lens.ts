/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

/**
 * Supported lens types
 */
export enum LensIds {
  CLEAR = 'clear',
  HIDDEN = 'hidden',
  HASHED = 'hashed',
  REDACT_PII = 'ada_detect_pii_types',
}

export enum DataIntegrity {
  STALE = 'stale',
  CURRENT = 'current',
}

/**
 * Returns a numeric representation of how restrictive a lens is, with 0 being least restrictive.
 */
export const getLensRestrictiveness = (lensId: LensIds): number =>
  ({
    [LensIds.CLEAR]: 0,
    [LensIds.HASHED]: 1,
    [LensIds.REDACT_PII]: 2,
    [LensIds.HIDDEN]: 3,
  }[lensId]);

/**
 * Return the least restrictive of the two given lenses
 * @param a first lens
 * @param b second lens
 */
export const getLeastRestrictiveLens = (a: LensIds, b: LensIds): LensIds =>
  compareLensRestrictiveness(a, b) < 0 ? a : b;

export const compareLensRestrictiveness = (a: LensIds, b: LensIds): number =>
  getLensRestrictiveness(a) > getLensRestrictiveness(b) ? 1 : -1;

export interface Udf {
  name: string;
  inputType: string;
  outputType: string;
}

export const UdfHash: Udf = {
  name: 'ada_hash',
  inputType: 'VARCHAR',
  outputType: 'VARCHAR',
};

// Glue/Athena primitive types
export const PRIMITIVE_TYPES = new Set([
  'boolean',
  'byte',
  'short',
  'int',
  'integer',
  'long',
  'tinyint',
  'smallint',
  'bigint',
  'float',
  'double',
  'decimal',
  'null',
  'char',
  'string',
  'varchar',
  'date',
  'datetime',
  'timestamp',
]);

/**
 * Return the types that are applicable for the given udf. Note that udf application adds a cast to the udf's inputType,
 * so return here only fields that could be cast to the given input type.
 */
const getApplicableInputTypes = (udf: Udf): Set<string> => {
  const inputType = udf.inputType.toLowerCase();

  if (inputType === 'varchar') {
    // All primitive types for varchar lenses are supported since we cast them to varchar
    return new Set(PRIMITIVE_TYPES);
  }
  // NOTE: consider other cases where glue crawled type might not match valid athena type
  return new Set([inputType]);
};

const isUdfApplicable = (udf: Udf, dataType: string) => getApplicableInputTypes(udf).has(dataType.toLowerCase());

/**
 * Return the udf to apply (if any) for the given lens
 */
export const getUdfsForLens = (lensId: LensIds, dataType?: string): Udf[] =>
  ((
    (
      {
        [LensIds.HASHED]: [UdfHash],
      } as any
    )[lensId] || []
  ).filter((udf: Udf) => !dataType || isUdfApplicable(udf, dataType)));
