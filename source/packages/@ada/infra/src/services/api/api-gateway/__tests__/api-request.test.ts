/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { apiGatewayEventWithEmptyDefaults } from '@ada/microservice-test-common';
import { getCallerDetails, isUserAllowed } from '../api-request';

describe('api-request', () => {
  describe('getCallerDetails', () => {
    it('should get the userId, groups and username from the request context', () => {
      expect(
        getCallerDetails(
          apiGatewayEventWithEmptyDefaults({
            requestContext: {
              authorizer: {
                'x-user-id': 'test-user',
                'x-username': 'test-user@usr.example.com',
                'x-groups': 'admin,analyst',
              },
            },
          }),
        ),
      ).toEqual({
        userId: 'test-user',
        username: 'test-user@usr.example.com',
        groups: ['admin', 'analyst'],
      });
    });

    it('should throw if the group, userId or username is not in the request context', () => {
      expect(() =>
        getCallerDetails(
          apiGatewayEventWithEmptyDefaults({
            requestContext: {
              authorizer: {},
            },
          }),
        ),
      ).toThrow();
      expect(() =>
        getCallerDetails(
          apiGatewayEventWithEmptyDefaults({
            requestContext: {
              authorizer: { 'x-user-id': 'test-user' },
            },
          }),
        ),
      ).toThrow();
      expect(() =>
        getCallerDetails(
          apiGatewayEventWithEmptyDefaults({
            requestContext: {
              authorizer: { 'x-groups': 'admin,analyst' },
            },
          }),
        ),
      ).toThrow();

      expect(() =>
        getCallerDetails(
          apiGatewayEventWithEmptyDefaults({
            requestContext: {
              authorizer: { 'x-username': 'test-user@usr.example.com' },
            },
          }),
        ),
      ).toThrow();
    });
  });

  describe('isUserAllowed', () => {
    it('should be allowed when caller id is same as user id', () => {
      expect(
        isUserAllowed(
          {
            userId: 'test-user',
            username: 'test-user@usr.example.com',
            groups: ['admin', 'analyst'],
          },
          'test-user',
          ['random-group'],
        ),
      ).toBe(true);
    });

    it('should be allowed when caller group is same as user group', () => {
      expect(
        isUserAllowed(
          {
            userId: 'test-user',
            username: 'test-user@usr.example.com',
            groups: ['admin', 'analyst'],
          },
          'user-1',
          ['admin'],
        ),
      ).toBe(true);
    });

    it('should NOT be allowed when there is no match in group or user id', () => {
      expect(
        isUserAllowed(
          {
            userId: 'test-user',
            username: 'test-user@usr.example.com',
            groups: ['admin', 'analyst'],
          },
          'user-1',
          ['business-analyst'],
        ),
      ).toBe(false);
    });
  });
});
