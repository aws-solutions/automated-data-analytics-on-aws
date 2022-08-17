/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { GroupStore } from '../../../api/components/ddb/groups';

/**
 * Handler for getting a group by groupId
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('getIdentityGroup', async ({ requestParameters }) => {
  const { groupId } = requestParameters;

  // Any user is permitted to retrieve any group
  const group = await GroupStore.getInstance().getGroup(groupId);
  if (!group) {
    return ApiResponse.notFound({ message: `Not Found: no group was found with groupId ${groupId}` });
  }
  return ApiResponse.success(group);
});
