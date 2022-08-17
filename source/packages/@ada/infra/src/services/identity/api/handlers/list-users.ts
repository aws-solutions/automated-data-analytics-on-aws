/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse, getPaginationParameters } from '@ada/api-gateway';
import { listUsers } from '../../../api/components/cognito/cognito-identity-service-provider';
import camelCase from 'lodash/camelCase';

export const handler = ApiLambdaHandler.for('listIdentityUsers', async ({ requestParameters }) => {
  const { filter } = requestParameters;

  // Listing users is governed by the api access policy
  const paginationParameters = getPaginationParameters(requestParameters);
  const result = await listUsers(paginationParameters, filter);

  if (result.error) {
    return ApiResponse.badRequest({ message: result.error });
  }

  return ApiResponse.success({
    users: result.items.map((q) => {
      const attr = q.Attributes || [];

      return {
        username: q.Username!,
        ...Object.fromEntries(attr.map((_q) => [camelCase(_q.Name), _q.Value])),
      };
    }),
    nextToken: result.nextToken,
  });
});
