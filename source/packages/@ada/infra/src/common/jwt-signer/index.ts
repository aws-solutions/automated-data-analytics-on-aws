/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CallingUser } from '@ada/common';
import { kms, secrets } from './sdk';
import jwt, { JwtPayload } from 'jsonwebtoken';

const { INTERNAL_TOKEN_KMS_KEY, INTERNAL_TOKEN_SECRET_NAME } = process.env;

export enum TokenType {
  INTERNAL = 'internal',
}

export interface VersionedKeyOutput {
  keyVersion: string;
  keyContent: string;
}

export interface VersionedToken {
  version?: string;
}

export interface JwtTokenContent {
  tokenId: string;
  machineId: string;
  username: string;
  secret: string;
}

export type SignedJwtTokenContent = JwtTokenContent & JwtPayload & VersionedToken;

export type SignedJwtInternalTokenContent = CallingUser & JwtPayload & VersionedToken;

/**
 * Get the key to be used to sign the jwt with
 * @returns the base64 plain key to be used to sign the jwt
 */
const getJwtSignKey = async (_tokenType: TokenType, versionId?: string): Promise<VersionedKeyOutput> => {
  const secret = await secrets
    .getSecretValue({
      SecretId: INTERNAL_TOKEN_SECRET_NAME ?? '',
      ...(versionId ? { VersionId: versionId } : {}),
    })
    .promise();

  const encryptedSecret = Buffer.from(secret.SecretString as string, 'base64');
  const key = await kms
    .decrypt({
      KeyId: INTERNAL_TOKEN_KMS_KEY ?? '',
      CiphertextBlob: encryptedSecret,
    })
    .promise();

  return {
    keyVersion: secret.VersionId as string,
    keyContent: key.Plaintext?.toString('base64') ?? '',
  };
};

/**
 * Create a signed JWT of the payload that provided as input
 * @param payload the payload to be incluted in the jwt
 * @param expiration the expiration date of the jwt
 * @returns the jwt string that includes the payload
 */
export const signJwt = async <T extends JwtTokenContent | CallingUser>(
  payload: T,
  expiration: Date,
  tokenType: TokenType = TokenType.INTERNAL,
): Promise<string> => {
  const currentKey = await getJwtSignKey(tokenType);
  const jwtContent = {
    ...payload,
    version: currentKey.keyVersion,
  };

  return jwt.sign(jwtContent, currentKey.keyContent, {
    expiresIn: Math.floor((expiration.getTime() - Date.now()) / 1000),
  });
};

/**
 * Verfiy a JWT token against the signature
 * @param jwtToken the jwt token to verify
 * @returns the verified token in case is correct, an exception otherwise
 */
export const verifyJwt = async <T extends SignedJwtTokenContent | SignedJwtInternalTokenContent>(
  jwtToken: string,
  tokenType: TokenType = TokenType.INTERNAL,
): Promise<T> => {
  const decoded = jwt.decode(jwtToken) as VersionedToken;
  const signKey = await getJwtSignKey(tokenType, decoded.version);

  return jwt.verify(jwtToken, signKey.keyContent) as T;
};
