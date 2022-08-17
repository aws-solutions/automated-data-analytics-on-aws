/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CognitoUser } from 'amazon-cognito-identity-js';
import { ENV_PRODUCTION } from '../../../config';
import { User } from '@ada/api';
import { compact, isEmpty } from 'lodash';

export interface UserProfile extends Omit<User, 'name' | 'username' | 'customGroups'> {
  id: string;
  name: string;

  groups: string[];

  cognitoUsername: string;
}

/* eslint-disable camelcase */
export type FederatedUserAttributes = {
  'custom:groups'?: string;
  'custom:claims'?: string;

  sub: string;
  preferred_username?: string;

  name?: string;
  nickname?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  address?: string;

  phone_number?: string;
  phone_number_verified: boolean;

  email?: string;
  email_verified: boolean;
};
/* eslint-enable */

export interface FederatedCognitoUser extends CognitoUser {
  attributes?: FederatedUserAttributes;
  name?: string;
  username: string;
  signInUserSession?: any;
}

function normalizeName(profile: Partial<UserProfile>): string {
  if (profile.name || profile.nickname) return (profile.name || profile.nickname) as string;

  const fullName = compact([profile.givenName, profile.familyName]);
  if (!isEmpty(fullName)) return fullName.join(' ');
  if (profile.email) return profile.email.split(/[@]/)[0];
  return profile.preferredUsername! || profile.id!;
}

export const userEntityToUserProfile = (user: User): UserProfile => {
  const id = (user.preferredUsername || user.username || user.email) as string;

  return {
    ...user,
    id,
    groups: (user.customGroups || '').split(','),
    name: normalizeName(user),
    cognitoUsername: user.username,
  };
};

export const federatedUserToUserProfile = (user: FederatedCognitoUser): UserProfile => {
  const { username } = user;
  const {
    sub,
    preferred_username: preferredUsername,
    email,
    phone_number: phoneNumber,
    address,
    family_name: familyName,
    given_name: givenName,
    middle_name: middleName,
    nickname,
  } = user.attributes || {};
  const customerGroups = user.attributes?.['custom:groups'];

  const id = (preferredUsername || username || email) as string;
  const profile: Omit<UserProfile, 'name'> = {
    id,
    preferredUsername,
    groups: (customerGroups || '').split(','),
    email,
    phoneNumber,
    address,
    familyName,
    givenName,
    middleName,
    nickname,
    sub,
    cognitoUsername: username,
  };

  return {
    ...profile,
    name: normalizeName(profile),
  };
};

export const TEST_USER: UserProfile = ENV_PRODUCTION
  ? ({} as any)
  : {
      id: 'test-user-id',
      preferredUsername: 'test-user-id',
      email: 'test@example.com',
      name: 'Testy Tester',
      phoneNumber: '111-111-1111',
      groups: ['admin'],
      cognitoUsername: 'admin-user',
    };

export const TEST_COGNITO_USER: Partial<FederatedCognitoUser> = ENV_PRODUCTION
  ? {}
  : {
      attributes: {
        sub: 'test-sub',
        preferred_username: 'test-preferred-username',
        email_verified: true,
        phone_number_verified: true,
        email: 'test@example.com',
        phone_number: '123.456.789',
        'custom:claims': '',
      },
      username: 'test-username',
    };
