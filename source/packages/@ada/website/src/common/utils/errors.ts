/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiError } from '@ada/api';
import { isApiError } from '@ada/api/client/types';

// NOTE: this is not ncessary since we always use api (after refactor) which
// already unpacks the api error for us
export const extractErrorDetails = async (e: any): Promise<ApiError> => {
  try {
    if (e && 'json' in e) {
      // if the error contain a json field, will invoke the function which resolves into an ApiError
      return e.json();
    }

    if (e?.response?.data) {
      // Errors thrown by failed Amplify requests
      return e.response.data;
    }

    return { message: e.message };
  } catch (tryError) {
    console.warn(tryError);
    return { message: e.message };
  }
};

const NOT_FOUND_MESSAGE_PATTERN = /not found/i;
const NOT_FOUND_CODE_PATTERN = /(404|NotFound)/i;
export function isNotFoundError(error?: any): boolean {
  if (error == null) return false;
  if (isApiError(error) || error.message != null) {
    return NOT_FOUND_MESSAGE_PATTERN.test(error.message) || NOT_FOUND_MESSAGE_PATTERN.test(error.details);
  }
  const code = String(error.statusCode || error.status || error.code);
  return code ? NOT_FOUND_CODE_PATTERN.test(code) : false;
}

const NOT_AUTHORIZED_MESSAGE_PATTERN = /not authorized/i;
const NOT_AUTHORIZED_CODE_PATTERN = /(401|Unauthorized)/i;
export function isUnauthorizedError(error?: any): boolean {
  if (error == null) return false;
  if (isApiError(error) || error.message != null) {
    return NOT_AUTHORIZED_MESSAGE_PATTERN.test(error.message) || NOT_AUTHORIZED_MESSAGE_PATTERN.test(error.details);
  }
  const code = String(error.statusCode || error.status || error.code);
  return code ? NOT_AUTHORIZED_CODE_PATTERN.test(code) : false;
}

const AUTHSESSION_MESSAGE_PATTERN = /Please authenticate/i;
const AUTHSESSION_CODE_PATTERN = /403|Forbidden/i;
export function isAuthError(error?: any): boolean {
  if (error == null) return false;
  if (isUnauthorizedError(error)) return true;
  if (isApiError(error) || error.message != null) {
    return AUTHSESSION_MESSAGE_PATTERN.test(error.message) || AUTHSESSION_MESSAGE_PATTERN.test(error.details);
  }
  const code = String(error.statusCode || error.status || error.code);
  return code ? AUTHSESSION_CODE_PATTERN.test(code) : false;
}

export function isExistingIdError(error?: any): boolean {
  return error && error.message && error.message === 'Item with same id already exists.';
}

export class FileUploadChunkError extends Error {
  public readonly chunk: number;

  constructor(message: string, chunk: number) {
    super(message);

    this.chunk = chunk;
  }
}
