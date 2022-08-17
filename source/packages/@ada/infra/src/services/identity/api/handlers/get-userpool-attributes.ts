/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { IdentityAttribute } from '@ada/api';
import { describeUserPool } from '../../../api/components/cognito/cognito-identity-service-provider';

/**
 * Handler for retrieving the user pool attributes
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('getIdentityAttributes', async () => {
  const identityProvider = await describeUserPool();

  return ApiResponse.success({
    attributes: identityProvider.UserPool!.SchemaAttributes!.map(
      (q): IdentityAttribute => ({
        name: q.Name!,
        type: q.AttributeDataType!,
        required: q.Required || false,
      }),
    ),
  });
});
