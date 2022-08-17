/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiError } from '@ada/api';
import { compact } from 'lodash';
import { useMemo } from 'react';

export type StatefulError = ApiError | Error | null | undefined;

// TODO: WIP - not sure if this is good pattern to surface errors, testing it out but probably move to imperative error handling
export function useStatefulErrors(...errors: StatefulError[]): NonNullable<StatefulError>[] | undefined {
  return useMemo(() => {
    const _errors = compact(errors);
    if (_errors.length) return _errors as NonNullable<StatefulError>[];
    return undefined;
  }, errors); // eslint-disable-line react-hooks/exhaustive-deps
}
