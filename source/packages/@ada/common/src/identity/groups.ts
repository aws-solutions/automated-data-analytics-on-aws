/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

/**
 * Groups that are defined at creation time
 */
export enum DefaultGroupIds {
  DEFAULT = 'default',
  POWER_USER = 'power_user',
  ADMIN = 'admin',
}

export enum DefaultClaims {
  ROOT = 'root',
}

export enum CustomCognitoAttributes {
  CLAIMS = 'claims',
  GROUPS = 'groups',
}
