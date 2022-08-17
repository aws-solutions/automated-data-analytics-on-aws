/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { StatusCodes } from 'http-status-codes';
import type { ApiError } from '../index';

export * from './types';

export * from '../types';

export * as Api from '../';

export * from './mocked';

/**
 * Create an error response to simulate errors thrown by the api client
 */
export const apiClientErrorResponse = (status: StatusCodes, error: ApiError) => ({
  status,
  json: async () => error,
});
