/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AwsAPIGatewayInstance } from '@ada/aws-sdk';
import { DefaultGroupIds } from '@ada/common';
import { UserPermission } from '@ada/api';
import { adminGetUser } from '../../components/cognito/cognito-identity-service-provider';
import { getResourcePoliciesFromGroups } from '../../components/groups';
import { startCase } from 'lodash';

const { REST_API_ID } = process.env;
const api = AwsAPIGatewayInstance();

const getAllAPIRoutesWithVerbs = async () => {
  const res = await api
    .getResources({
      restApiId: REST_API_ID ?? '',
      // 500 is the max
      limit: 500,
    })
    .promise();

  return res
    .items!.map((i) =>
      Object.keys(i.resourceMethods!)
        .filter((q) => !!q && q !== 'OPTIONS')
        .map((r) => `${r}${i.path!}`),
    )
    .flat();
};

const transformRouteToMethodName = (route: string): string => {
  return route
    .split('/')
    .map((part) => {
      if (!/\{([^\\{}]+)\}/.test(part)) {
        return startCase(part.toLocaleLowerCase()).split(' ').join('');
      }

      return '';
    })
    .join('');
};

/**
 * Handler for getting the routes which the user has access to
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('getPermissionUser', async ({ requestParameters }, callingUser) => {
  const { userId } = requestParameters;

  // callingUser.username is the cognito username that should be used to invoke this api as well
  // callingUser.userId is the preferred_username (may or may not fallback to cognito username)
  if (userId !== callingUser.username && !callingUser.groups.includes(DefaultGroupIds.ADMIN)) {
    return ApiResponse.forbidden({
      message: `You can't get permissions of another user if you don't have admin access.`,
    });
  }

  let user;
  try {
    user = await adminGetUser(userId);
  } catch (err: any) {
    console.log('Error retrieving the user');
    console.log(err);

    return ApiResponse.badRequest({
      message: `Error retrieving user permissions, the user ${userId} does not exist`,
    });
  }

  const apiWithVerbs = await getAllAPIRoutesWithVerbs();
  const permissions = await getResourcePoliciesFromGroups(
    user.UserAttributes!.find((q) => q.Name === 'custom:groups')!.Value!.split(','),
  );
  const permissionsPatterns = permissions.map((q) => {
    // transform the resource policies into a regex. For example:
    // arn:aws:execute-api:ap-southeast-2:123456789012:xxxxxxxxxx/stage/POST/query-parse-render/*
    // become:
    // ^POST\/query-parse-render\/(.*)$
    const [_, _stage, ...path] = q.split('/');
    const regexPath = path.map((_q) => (_q === '*' ? '(.*)' : _q)).join('\\/');

    return new RegExp(`^${regexPath}$`, 'i');
  });

  return ApiResponse.success({
    permissions: apiWithVerbs.reduce((inc, _api): UserPermission => {
      const hasAccess = permissionsPatterns.some((q) => {
        return q.test(_api);
      });

      return { ...inc, [transformRouteToMethodName(_api)]: { access: hasAccess } } as UserPermission;
    }, {}),
  });
});
