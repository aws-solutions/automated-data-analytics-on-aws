/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type * as Api from '../'; // virtual dir reference to "client"
import type { ApiOperationName } from '../types';
import type { DeepPartial } from '../../../../../@types/ts-utils';
import type { jest } from '@jest/globals';

type API = Api.DefaultApi;

export type MockApiClient = {
  [I in ApiOperationName]: I extends ApiOperationName
    ? API[I] extends (...args: infer P) => infer R
      ? R extends Promise<infer U>
        ? jest.Mock<Promise<DeepPartial<U>>, P>
        : never
      : never
    : never;
};
