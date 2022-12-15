/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fs from 'fs';
import { APIGatewayProxyEvent, APIGatewayProxyEventHeaders } from 'aws-lambda';
import {
  AdditionalHeaders,
  AuthorizationType,
  CallerDetailsKeys,
  CognitoTokenTypes,
  CustomCognitoAttributes,
  addDays,
} from '@ada/common';
import { DefaultUser } from '@ada/microservice-common';
import { Logger } from '@ada/infra-common/constructs/lambda/lambda-logger';
import { SignedJwtInternalTokenContent, TokenType, verifyJwt } from '@ada/jwt-signer';
import { TokenStore } from '../../components/ddb/token-provider';
import { VError } from 'verror';
import { adminGetUser } from '../../components/cognito/cognito-identity-service-provider';
import { getAccessToken } from '../../../../common/services/utils/cognito';
import { getResourcePoliciesFromGroups } from '../../components/groups';
import fetch from 'node-fetch';
import jwkToPem from 'jwk-to-pem';
import jwt from 'jsonwebtoken';
import uniq from 'lodash/uniq';

class AuthError extends VError {
  constructor(message: string, cause?: Error) {
    log.warn(message, cause);

    super({ name: 'AuthError', cause }, message);
  }
}

export const MAX_USER_MISSING_LOGIN = 90; // days

const log = Logger.getLogger({ tags: ['CustomAuthorizer'] });

const { AWS_REGION, USER_POOL_ID, USER_ID_SCOPE } = process.env;
const DEFAULT_ACCESS_POLICIES = process.env.DEFAULT_ACCESS_POLICIES?.split(',');
const getKeyFromKid = (keys: any[], kid: string) => keys.find((q) => q.kid === kid);

export const getJwk = async (kid: string) => {
  const tmpFile = '/tmp/jwk.json';
  let jwkContent = null;

  if (fs.existsSync(tmpFile)) {
    jwkContent = fs.readFileSync(tmpFile, 'utf-8');
  }

  if (!jwkContent) {
    const response = await fetch(
      `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`,
    );
    const result = await response.text();

    // store it to avoid performing another http call, the content of the jwk file is public
    fs.writeFileSync(tmpFile, result, 'utf-8');

    return getKeyFromKid(JSON.parse(result).keys, kid);
  }

  return getKeyFromKid(JSON.parse(jwkContent).keys, kid);
};

export type CustomAuthorizerEventType = APIGatewayProxyEvent & { type: string; methodArn: string };

const generatePolicyDocument = async (userId: string, username: string, groups: string[]) => {
  try {
    // if the user does not belong to any group
    if (!groups || groups.length === 0) {
      return buildPolicyDocument(userId, username, groups, DEFAULT_ACCESS_POLICIES ?? []);
    }
    const resources = await getResourcePoliciesFromGroups(groups);

    return buildPolicyDocument(userId, username, groups, resources);
  } catch (err) {
    log.error('Error generating the policy: ', { err });

    throw err;
  }
};

const buildPolicyDocument = (userId: string, username: string, groups: string[], resources: string[]) => ({
  principalId: userId,
  policyDocument: {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'execute-api:Invoke',
        Effect: 'Allow',
        Resource: uniq(resources),
      },
    ],
  },
  context: {
    [CallerDetailsKeys.USER_ID]: userId,
    [CallerDetailsKeys.USERNAME]: username,
    [CallerDetailsKeys.GROUPS]: (groups || []).join(','),
  },
});

const parseJwtToken = async (token: string, type: string): Promise<jwt.JwtPayload> => {
  try {
    // https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-verifying-a-jwt.html
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) {
      throw new VError({ name: 'TokenDecodeError' }, `Cannot decode the ${type} token`);
    }

    const pem = jwkToPem(await getJwk(decoded.header.kid!));

    return jwt.verify(token, pem) as jwt.JwtPayload;
  } catch (err: any) {
    log.error(`Error parsing the ${type} token`, { err });

    throw new VError({ name: 'JwtParsingError', cause: err }, `Error parsing the provided ${type} token`);
  }
};

/**
 * Process the incoming machine token provided as API key
 * @param token the api token
 * @returns return the policy to be applied or throw an error in case the token is not valid
 */
const processAccessTokenFromApiKey = async (verifiedAccessToken: jwt.JwtPayload) => {
  log.info('Process Access token from API Key');
  /// the access token in this case is coming from a cognitoUserPool Client
  const issuer = `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}`;

  if (verifiedAccessToken.iss !== issuer) {
    throw new AuthError('Token issued with a non valid issuer');
  }

  if (verifiedAccessToken.token_use !== CognitoTokenTypes.ACCESS) {
    throw new AuthError('The provided access token does not have the right token_use');
  }

  // verify if token is expired
  const now = Date.now();
  const nowInSec = Math.floor(now / 1000);

  if (verifiedAccessToken.exp! <= nowInSec) {
    throw new AuthError('The access token is expired');
  }

  const storedToken = await TokenStore.getInstance().getTokenByClientId(verifiedAccessToken.client_id);
  // token does not exists
  if (!storedToken) {
    throw new AuthError('The provided token belongs to an entity that does not exist anymore in the db');
  }

  // token is disabled
  if (!storedToken.enabled) {
    throw new AuthError('The provided token is disabled');
  }

  if (new Date(storedToken.expiration).getTime() <= Date.now()) {
    throw new AuthError(`The token linked to the clinetId ${verifiedAccessToken.client_id} is expired`);
  }

  const cognitoUser = await adminGetUser(storedToken.username);
  if (!cognitoUser) {
    throw new AuthError('The provided token belongs to a user that does not exist');
  }

  if (cognitoUser.UserLastModifiedDate! < addDays(Date.now(), -MAX_USER_MISSING_LOGIN)) {
    throw new AuthError(
      `The provided token belongs to a user that did not login in the system in the last ${MAX_USER_MISSING_LOGIN} days`,
    );
  }

  const ownerAttributes = cognitoUser.UserAttributes || [];

  return generatePolicyDocument(
    storedToken.createdBy!,
    storedToken.username,
    ((ownerAttributes.find((q) => q.Name === `custom:${CustomCognitoAttributes.GROUPS}`) || {}).Value || '')
      .split(',')
      .filter((q) => q),
  );
};

const processAccessToken = async (verifiedAccessToken: jwt.JwtPayload, headers: APIGatewayProxyEventHeaders) => {
  log.debug('Processing access token');
  const verifiedIdToken = await parseJwtToken(headers[AdditionalHeaders.ID_TOKEN]!, CognitoTokenTypes.ID);
  const issuer = `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}`;

  if (verifiedAccessToken.iss !== issuer || verifiedIdToken.iss !== issuer) {
    throw new AuthError('Token issued with a non valid issuer');
  }

  if (verifiedAccessToken.token_use !== CognitoTokenTypes.ACCESS) {
    throw new AuthError('The provided access token does not have the right token_use');
  }

  if (verifiedIdToken.token_use !== CognitoTokenTypes.ID) {
    throw new AuthError('The provided id token does not have the right token_use');
  }

  // Caller details headers are for use in internal (ie sigv4) calls only
  if (CallerDetailsKeys.USER_ID in headers || CallerDetailsKeys.GROUPS in headers) {
    throw new AuthError('The request contains unsupported fields for this token');
  }

  // verify if token is expired
  const nowInSec = Math.floor(Date.now() / 1000);
  if (verifiedAccessToken.exp! <= nowInSec || verifiedIdToken.exp! <= nowInSec) {
    throw new AuthError('The token is expired');
  }

  // set the preferred username as principal, if available, otherwise uses the normal username
  const userId = verifiedIdToken.preferred_username || verifiedAccessToken.username;

  // No external access is permitted for system user
  if (userId === DefaultUser.SYSTEM) {
    throw new AuthError('System users cannot utilise external tokens');
  }

  return generatePolicyDocument(userId, verifiedAccessToken.username, verifiedAccessToken['cognito:groups']);
};

const processInternalToken = async (token: string) => {
  log.debug('Processing internal token');

  let verified: SignedJwtInternalTokenContent;
  try {
    verified = await verifyJwt<SignedJwtInternalTokenContent>(token, TokenType.INTERNAL);
  } catch (err: any) {
    throw new AuthError('Error parsing the internal token', err);
  }

  const { userId, groups, username, exp: expiration } = verified!;

  if (!userId || !groups || groups.length === 0 || !username) {
    throw new AuthError('Missing any of the following in the token: userId, groups or username');
  }

  const nowInSec = Math.floor(Date.now() / 1000);
  if (!expiration || expiration <= nowInSec) {
    throw new AuthError('The provided token is expired');
  }

  // System user with an internal token is permitted to call any api
  return userId === DefaultUser.SYSTEM
    ? buildPolicyDocument(userId, username, groups, ['*'])
    : generatePolicyDocument(userId, username, groups);
};

export const handler = async (event: CustomAuthorizerEventType, context: any = {}): Promise<any> => {
  try {
    const auth = event.headers.Authorization || event.headers.authorization || '';
    const [type, token] = auth.split(' ');

    if (!type || !token) {
      throw new AuthError('Missing type or token in the Authorization header');
    }

    let tokenToProcesss = token;
    let lowerType = type.toLocaleLowerCase();

    // coming from external api calls (machine tokens)
    if (lowerType === AuthorizationType.API_KEY) {
      log.debug('Retrieving access token from API KEY');
      // retrieve the access token
      tokenToProcesss = await getAccessToken(token);
      // set the auth as Bearer as the API was exchanged for a bearer token
      lowerType = AuthorizationType.BEARER;
    }

    // token coming from UI
    // if the auth type is API_KEY the tokenToProcesss contains
    // the Cognito auth token retrieved by using the API key provided initially in the token value
    if (lowerType === AuthorizationType.BEARER) {
      const verifiedAccessToken = await parseJwtToken(tokenToProcesss, CognitoTokenTypes.ACCESS);

      // the USER_ID_SCOPE is only available for access tokens that are generated from API Keys
      if (verifiedAccessToken.scope === USER_ID_SCOPE) {
        return await processAccessTokenFromApiKey(verifiedAccessToken);
      }

      return await processAccessToken(verifiedAccessToken, event.headers);
    }

    if (lowerType === AuthorizationType.INTERNAL_TOKEN) {
      return await processInternalToken(tokenToProcesss);
    }

    log.warn('Unknown type the Authorization header: ', { type });

    throw new VError(
      { name: 'UnknownTypeInAuthHeaderError', info: { details: `Unknown type the Authorization header: ${type}` } },
      'Unauthorized',
    );
  } catch (err) {
    // logging not needed as already done in the custom auth error
    // this is required to avoid { message: null } in response
    return context.fail('Unauthorized');
  }
};
