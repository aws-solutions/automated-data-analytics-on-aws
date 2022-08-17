/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
export interface Machine {
  machineId: string;
  description?: string;
  updatedTimestamp?: string;
}

export interface Token {
  machineId: string;
  tokenId: string;
  expiration: string;
  enabled: boolean;
  authToken?: string;
  authUrl?: string;
  clientSecret?: string;
  username: string;
  clientId: string;
  updatedTimestamp?: string;
}
