/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
export interface CallingUser {
  readonly userId: string;
  readonly username: string;
  readonly groups: string[];
}

export enum CallerDetailsKeys {
  USER_ID = 'x-user-id',
  USERNAME = 'x-username',
  GROUPS = 'x-groups',
}
