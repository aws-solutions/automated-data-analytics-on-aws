/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CallingUser } from '../api/caller-details';

/**
 * Prefix for principal tag keys
 */
export const PRINCIPAL_TAG_KEY_PREFIX = 'ada:';

/**
 * The possible principal tag keys to be included in the request (prefixed by the above)
 */
export enum PrincipalTagKey {
  SERVICE = 'service',
  USER = 'user',
  GROUPS = 'groups',
}

/**
 * Possible services to identify as in requests to external AWS resources
 */
export enum PrincipalTagServiceValue {
  DATA_PRODUCT = 'data-product',
  QUERY = 'query',
}

interface PrincipalTag {
  readonly key: string;
  readonly value: string;
}

/**
 * Builds the tags to be associated with a role or assume-role session when interacting with AWS entities external to
 * the system.
 * @param service the service performing the request
 * @param callingUser the user performing the request
 */
export const buildPrincipalTags = (service: PrincipalTagServiceValue, callingUser?: CallingUser): PrincipalTag[] =>
  [
    /**
     * For matching against the specific microservice making the request, eg:
     *
     * {
     *   ...
     *   "Condition": {
     *     "StringEquals": {
     *       "aws:PrincipalTag/ada:service": "query"
     *     }
     *   }
     * }
     *
     * or any microservice:
     *
     * {
     *   ...
     *   "Condition": {
     *     "StringLike": {
     *       "aws:PrincipalTag/ada:service": "*"
     *     }
     *   }
     * }
     */
    { key: PrincipalTagKey.SERVICE, value: service },

    ...(callingUser
      ? [
          /**
           * For matching against the specific user making the request, eg:
           * Tags value pattern: [\p{L}\p{Z}\p{N}_.:/=+\-@]+.
           * More details: https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html
           * {
           *   ...
           *   "Condition": {
           *     "StringEquals": {
           *       "aws:PrincipalTag/ada:user": "darthvader"
           *     }
           *   }
           * }
           */
          { key: PrincipalTagKey.USER, value: callingUser.userId.replace(/[^\p{L}\p{Z}\p{N}_.:/=+\\-]*/giu, '') },
          /**
           * For matching against the groups of the user making the request. All of a user's groups are included in this
           * tag, delimited by ':'.
           *
           * Eg. must be in a particular group:
           * {
           *   ...
           *   "Condition": {
           *     "StringLike": {
           *       "aws:PrincipalTag/ada:groups": "*:power_user:*"
           *     }
           *   }
           * }
           *
           * Eg. must be in one of a list of groups:
           *
           * {
           *   ...
           *   "Condition": {
           *     "ForAnyValue:StringLike": {
           *       "aws:PrincipalTag/ada:groups": [
           *         "*:power_user:*",
           *         "*:admin:*"
           *       ]
           *     }
           *   }
           * }
           */
          { key: PrincipalTagKey.GROUPS, value: `:${callingUser.groups.join(':')}:` },
        ]
      : []),
  ].map(({ key, value }) => ({ key: `${PRINCIPAL_TAG_KEY_PREFIX}${key}`, value }));
