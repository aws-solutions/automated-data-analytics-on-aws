/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { ApiError } from '@ada/api';

import { MOCK_API_CLIENT } from '@ada/api-client/mock';

jest.mock('@ada/api-client');

export {
  // match structure of client/index.ts
  MOCK_API_CLIENT as api,
};

export class RequestError extends Error {
  public readonly body: ApiError;

  constructor(message: string, body: ApiError) {
    super(message);
    this.body = body;
  }

  async json(): Promise<ApiError> {
    return Promise.resolve(this.body);
  }
}
