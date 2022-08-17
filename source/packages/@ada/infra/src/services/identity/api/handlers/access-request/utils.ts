/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CallingUser } from '@ada/common';

/**
 * Return the owners of the group to notify for creating/actioning an access request
 * @param callingUser the user creating/actioning the request
 * @param groupCreator the creator of the given group
 */
export const getGroupOwnersToNotify = async (callingUser: CallingUser, groupCreator: string): Promise<string[]> => {
  // NOTE: When the group was created by the system, we might wish to consider notifying members of the admin group
  // (and the root admin). For now the UI polls access requests for the system-created groups to ensure admins are notified.
  const groupOwners = [groupCreator];

  // If the calling user is also an owner of the group, there's no need to send a notification
  return groupOwners.includes(callingUser.userId) ? [] : groupOwners;
};
