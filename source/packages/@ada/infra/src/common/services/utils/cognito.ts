/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { URLSearchParams } from 'url';
import fetch from 'node-fetch';

/**
 * Utility function used to request the access token from cognito using
 * basica authorization: https://docs.aws.amazon.com/cognito/latest/developerguide/token-endpoint.html
 * @param basicAuth basic auth encoded as base64(client_id:client_secret)
 * @returns an access token
 */
export const getAccessToken = async (basicAuth: string): Promise<string> => {
  const urlencoded = new URLSearchParams();
  urlencoded.append('grant_type', 'client_credentials');

  const result = await fetch(`https://${process.env.COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: urlencoded,
  });
  const body = JSON.parse(await result.text());

  return body.access_token;
};
