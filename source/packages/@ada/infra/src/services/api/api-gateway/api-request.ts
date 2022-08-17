/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { APIGatewayEventRequestContext, APIGatewayProxyEvent } from 'aws-lambda';
import { CallerDetailsKeys, CallingUser } from '@ada/common';
import { VError } from 'verror';

/**
 * Returns details about the caller of the microservice
 * @param event apigateway proxy request event
 */
export const getCallerDetails = (event: APIGatewayProxyEvent): CallingUser => {
  const userId = (event.requestContext?.authorizer || {})[CallerDetailsKeys.USER_ID];
  const groups = (event.requestContext?.authorizer || {})[CallerDetailsKeys.GROUPS];
  const username = (event.requestContext?.authorizer || {})[CallerDetailsKeys.USERNAME];

  if (groups === undefined || !userId || !username) {
    throw new VError(
      { name: 'MissingCallerDetailsError' },
      `Missing ${CallerDetailsKeys.USER_ID} (${userId}), ${CallerDetailsKeys.GROUPS} (${groups}) or ${CallerDetailsKeys.USERNAME} (${username}) headers/context`,
    );
  }
  return { userId, username, groups: groups.split(',') };
};

export interface MicroserviceApiRequestProps {
  pathParameters?: { [key: string]: string };
  multiValueQueryStringParameters?: { [key: string]: string[] };
  queryStringParameters?: { [key: string]: string };
  body?: any;
}

const buildRequestContext = ({ userId, groups, username }: CallingUser): APIGatewayEventRequestContext =>
  ({
    authorizer: {
      [CallerDetailsKeys.USER_ID]: userId,
      [CallerDetailsKeys.USERNAME]: username,
      [CallerDetailsKeys.GROUPS]: groups.join(','),
    },
  } as unknown as APIGatewayEventRequestContext);

/**
 * Build an apigateway request to send to a microservice for internal calls that bypass apigateway
 * @param callingUser the calling user
 * @param pathParameters path parameters in the request
 * @param body body of the request
 */
export const buildApiRequest = (
  callingUser: CallingUser,
  { pathParameters, body, multiValueQueryStringParameters, queryStringParameters }: MicroserviceApiRequestProps,
): Partial<APIGatewayProxyEvent> => ({
  requestContext: buildRequestContext(callingUser),
  pathParameters,
  multiValueQueryStringParameters,
  queryStringParameters,
  body: body ? JSON.stringify(body) : '',
});

export const isUserAllowed = (callingUser: CallingUser, userId: string, groups: string[]): boolean => {
  const { userId: callerUserId, groups: callerGroups } = callingUser;

  return groups.some((q: string): boolean => callerGroups.includes(q)) || userId === callerUserId;
};

export interface PaginationParameters {
  readonly nextToken?: string;
  readonly pageSize?: number;
  readonly limit?: number;
}

/**
 * If defined, parses the string as a number. Throws an error if the string was defined but an invalid number.
 * @param s optional string to convert
 */
const optionalStringToNumber = (s?: string): number | undefined => {
  if (s === undefined) {
    return s;
  }
  const numberS = Number(s);
  if (isNaN(numberS)) {
    throw new VError({ name: 'NotANumberError' }, `${s} expected to be a number`);
  }
  return numberS;
};

/**
 * Returns pagination query parameters from the request if present
 * @param requestParameters api request parameters
 */
export const getPaginationParameters = (requestParameters: {
  nextToken?: string;
  pageSize?: string;
  limit?: string;
}): PaginationParameters => {
  const { nextToken, pageSize, limit } = requestParameters;

  const paginationParameters = {
    nextToken,
    pageSize: optionalStringToNumber(pageSize),
    limit: optionalStringToNumber(limit),
  };
  console.log(`paginationParameters: ${paginationParameters}`);

  return paginationParameters;
};

/**
 * Encode pagination details into an opaque stringified token
 * @param paginationToken pagination token details
 */
export const toToken = <T>(paginationToken?: T): string | undefined =>
  paginationToken ? encodeURIComponent(Buffer.from(JSON.stringify(paginationToken)).toString('base64')) : undefined;

/**
 * Decode a stringified token
 * @param token a token passed to the paginated request
 */
export const fromToken = <T>(token?: string): T | undefined =>
  token ? (JSON.parse(Buffer.from(decodeURIComponent(token), 'base64').toString()) as T) : undefined;
