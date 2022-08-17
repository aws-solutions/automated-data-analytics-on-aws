/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CustomCognitoAttributes, DefaultGroupIds } from '@ada/common';
import { GroupStore } from '../../components/ddb/groups';
import { Logger } from '@ada/infra-common/constructs/lambda/lambda-logger';
import { adminUpdateUserAttributes } from '../../components/cognito/cognito-identity-service-provider';
import uniq from 'lodash/uniq';

export const ENABLE_CLAIMS_TO_GROUP_MAPPING = false;

/**
 * Type information for the lambda event for the PreTokenGeneration trigger
 */
export interface PreTokenGenerationEvent {
  triggerSource?: string;
  userPoolId?: string;
  region: string;
  userName: string;
  request: {
    userAttributes: { [key: string]: string };
    groupConfiguration: {
      groupsToOverride: string[];
      iamRolesToOverride: string[];
      preferredRole: string[] | null;
    };
  };
  response: {
    claimsOverrideDetails?: {
      claimsToAddOrOverride?: { [key: string]: string };
      claimsToSuppress?: string[];
      groupOverrideDetails?: {
        groupsToOverride?: string[];
        iamRolesToOverride?: string[];
        preferredRole?: string;
      };
    } | null;
  };
}

/**
 * remove chars that are not considered part of the string value
 * eg. multivalue input are coming as "[value1, value2]", remove the array braces
 * @param input the string as input to be sanitised
 * @returns a sanitised string
 */
const sanitiseInput = (input: string) => input.replace(/(^\[+)|(\]$)/g, '');

/**
 * Lambda trigger used to add groups before the Cognito token gets generated
 * @param event cognito Pre Token Generation event
 * @param context context
 */
export const handler = async (event: PreTokenGenerationEvent, context: any): Promise<PreTokenGenerationEvent> => {
  const { AUTO_ASSOCIATE_ADMIN, ADMIN_EMAIL } = process.env;
  const log = Logger.getLogger({
    lambda: {
      event,
      context,
    },
  });

  const groupStore = GroupStore.getInstance();

  // cognito prepend custom attributs with `custom:`
  const claimsFullAttributeName = `custom:${CustomCognitoAttributes.CLAIMS}`;
  const groupsFullAttributeName = `custom:${CustomCognitoAttributes.GROUPS}`;
  const claims = event.request.userAttributes[claimsFullAttributeName] || '';
  let groups: string[] = [];

  if (ENABLE_CLAIMS_TO_GROUP_MAPPING && claims) {
    const claimsArray = sanitiseInput(claims)
      .split(',')
      .map((q) => q.trim());
    log.debug(`claimsArray: ${claimsArray}`);
    const groupMapping = await groupStore.batchGetClaims(claimsArray);
    groups = Object.entries(groupMapping).flatMap(([_, value]) => value.groupIds);
  }

  // if auto admin association is enabled
  // will inspect the email and sub attribute and verify that either one of them includes the ADMIN_EMAIL address
  // if that's the case, will add the Ada admin group to the user
  if (
    AUTO_ASSOCIATE_ADMIN === 'true' &&
    [event.request.userAttributes.email, event.request.userAttributes.sub].includes(ADMIN_EMAIL ?? '')
  ) {
    groups.push(DefaultGroupIds.ADMIN);
  }

  // NOTE: will need to implement pagination once applied to backend
  const autoAssignGroups = await groupStore.filterGroupsByAttribute('autoAssignUsers', true, {});

  if (autoAssignGroups.groups.length > 0) {
    groups = groups.concat(autoAssignGroups.groups.map((q) => q.groupId));
    log.debug(`Concatenating groups`, { groups });
  }

  // NOTE: will need to implement pagination once applied to backend
  // use the preferred_username to search the user, if present. Otherwise fallback on the cognito username
  const userGroups = await groupStore.getMember(event.request.userAttributes.preferred_username || event.userName);
  if (userGroups) {
    groups = groups.concat(userGroups.groupIds);
    log.debug(`User group was found, concatenating groups`, { groups });
  }

  const groupsToOverride = uniq(groups);
  log.debug(`groupsToOverride: , ${groupsToOverride}`);
  await adminUpdateUserAttributes(event.userName, [
    { key: groupsFullAttributeName, value: groupsToOverride.join(',') },
  ]);

  event.response.claimsOverrideDetails = {
    claimsToAddOrOverride: {
      preferred_username: event.request.userAttributes.preferred_username,
    },
    groupOverrideDetails: {
      groupsToOverride,
    },
  };

  return event;
};
