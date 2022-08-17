/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import jest from 'jest-mock';
import type { ApiOperationName } from '../types';
import type { MockApiClient } from './types';

const fns: MockApiClient = {} as any;
export const proxy: MockApiClient = new Proxy({} as any, {
  get: <P extends ApiOperationName>(target: any, prop: P, _receiver: any) => {
    // set default empty jest mock function for each client method
    if (fns[prop] == null) {
      fns[prop] = jest.fn() as any;
    }

    return fns[prop];
  },
});
