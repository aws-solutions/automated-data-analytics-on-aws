/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  CustomCognitoAttributes,
  DATE_VALIDATION,
  DESCRIPTION_VALIDATION,
  ID_VALIDATION,
  IdentityProviderType,
  NAME_VALIDATION,
  USER_IDENTIFIER_VALIDATION,
  extendSchema,
} from '@ada/common';
import { JsonSchema, JsonSchemaType } from 'aws-cdk-lib/aws-apigateway';
import { capitalize } from 'lodash';

// this is only used in output, users are never created
export const UserIdentifier: JsonSchema = {
  id: `${__filename}/UserIdentifier`,
  type: JsonSchemaType.OBJECT,
  properties: {
    username: {
      type: JsonSchemaType.STRING,
      description: 'The username of the user',
    },
  },
  required: ['username'],
};

// this is only used in output, users are never created
export const UserSchema: JsonSchema = extendSchema(
  {
    id: `${__filename}/User`,
    type: JsonSchemaType.OBJECT,
    properties: {
      preferredUsername: {
        type: JsonSchemaType.STRING,
        description: 'The preferred_username attribute that is used to identity the user',
      },
      phoneNumber: {
        type: JsonSchemaType.STRING,
        description: 'The phone number of the user',
      },
      givenName: {
        type: JsonSchemaType.STRING,
        description: 'The given name of the user',
      },
      familyName: {
        type: JsonSchemaType.STRING,
        description: 'The family name of the user',
      },
      middleName: {
        type: JsonSchemaType.STRING,
        description: 'The middle name of the user',
      },
      nickname: {
        type: JsonSchemaType.STRING,
        description: 'The nickname of the user',
      },
      address: {
        type: JsonSchemaType.STRING,
        description: 'The address of the user',
      },
      name: {
        type: JsonSchemaType.STRING,
        description: 'The name of the user',
      },
      sub: {
        type: JsonSchemaType.STRING,
        description: 'The Cognito sub of the user, equivalent to the ID',
      },
      [`custom${capitalize(CustomCognitoAttributes.GROUPS)}`]: {
        type: JsonSchemaType.STRING,
        description: 'List of groups that the user belongs to, separated by comma',
      },
      email: {
        type: JsonSchemaType.STRING,
        description: `The user's email address`,
      },
    },
  },
  UserIdentifier,
);

export const GroupMembers: JsonSchema = {
  id: `${__filename}/GroupMembers`,
  type: JsonSchemaType.OBJECT,
  properties: {
    members: {
      type: JsonSchemaType.ARRAY,
      description: 'The members that belong to this group, defined by values of preferred_username.',
      items: {
        type: JsonSchemaType.STRING,
      },
    },
  },
  required: ['members'],
};

export const GroupIdentifier: JsonSchema = {
  id: `${__filename}/GroupIdentifier`,
  type: JsonSchemaType.OBJECT,
  properties: {
    groupId: {
      type: JsonSchemaType.STRING,
      description: 'Identifier for the group',
      ...ID_VALIDATION,
    },
  },
  required: ['groupId'],
};

/**
 * Schema for a group
 */
export const Group: JsonSchema = extendSchema(
  {
    id: `${__filename}/Group`,
    type: JsonSchemaType.OBJECT,
    properties: {
      description: {
        type: JsonSchemaType.STRING,
        description: 'A description of the group',
        ...DESCRIPTION_VALIDATION,
      },
      claims: {
        type: JsonSchemaType.ARRAY,
        description:
          'The identity provider claims or machine ids associated with this group. ' +
          'If a user has one or more of these claims, they are considered part of the group',
        items: {
          type: JsonSchemaType.STRING,
          ...ID_VALIDATION,
        },
      },
      apiAccessPolicyIds: {
        type: JsonSchemaType.ARRAY,
        description:
          'The api access policies associated with the group. ' +
          'These policy ids map to sets of api paths to define what apis the group may call.',
        // For now these ids map to hardcoded lists of api paths. In future we can consider allowing the access policies
        // themselves to be customised for more fine-grained access to the API.
        items: {
          type: JsonSchemaType.STRING,
          ...ID_VALIDATION,
        },
      },
      autoAssignUsers: {
        type: JsonSchemaType.BOOLEAN,
        description: 'Flag to automatically add users to this group',
      },
    },
    required: ['claims', 'members', 'apiAccessPolicyIds'],
  },
  GroupIdentifier,
  GroupMembers,
);

export const MachineIdentifier: JsonSchema = {
  id: `${__filename}/MachineIdentifier`,
  type: JsonSchemaType.OBJECT,
  properties: {
    machineId: {
      type: JsonSchemaType.STRING,
      description: 'Identifier for the machine',
      ...ID_VALIDATION,
    },
  },
  required: ['machineId'],
};

export const TokenIdentifier: JsonSchema = extendSchema(
  {
    id: `${__filename}/TokenIdentifier`,
    type: JsonSchemaType.OBJECT,
    properties: {
      tokenId: {
        type: JsonSchemaType.STRING,
        description: 'Identifier of the token',
        ...ID_VALIDATION,
      },
    },
    required: ['tokenId'],
  },
  MachineIdentifier,
);

/**
 * Schema for a token
 */
export const Token: JsonSchema = extendSchema(
  {
    id: `${__filename}/Token`,
    type: JsonSchemaType.OBJECT,
    properties: {
      expiration: {
        type: JsonSchemaType.STRING,
        description: 'The expiration date of the token',
        ...DATE_VALIDATION,
      },
      enabled: {
        type: JsonSchemaType.BOOLEAN,
        description: 'Define whether the token is active or not',
      },
      username: {
        type: JsonSchemaType.STRING,
        description: 'The username associated with the token.',
      },
      clientId: {
        type: JsonSchemaType.STRING,
        description: 'The clientId of the token.',
      },
      clientSecret: {
        type: JsonSchemaType.STRING,
        description: 'The clientSecret of the token, only available during initial create response.',
      },
      authUrl: {
        type: JsonSchemaType.STRING,
        description: 'The authentication url used to authorize the token',
      },
      authToken: {
        type: JsonSchemaType.STRING,
        description: 'The base64 encoded clientId and clientSecret, only available during initial create response.',
      },
    },
    required: ['expiration', 'enabled', 'username', 'clientId'],
  },
  TokenIdentifier,
);

/**
 * Schema for a machine
 */
export const Machine: JsonSchema = extendSchema(
  {
    id: `${__filename}/Machine`,
    type: JsonSchemaType.OBJECT,
    properties: {
      description: {
        type: JsonSchemaType.STRING,
        description: 'A description of the machine',
        ...DESCRIPTION_VALIDATION,
      },
    },
  },
  MachineIdentifier,
);

export const IdentityProviderTypeSchema: JsonSchema = {
  id: `${__filename}/IdentityProviderTypeEnum`,
  type: JsonSchemaType.STRING,
  description: 'The type of identity provider, SAML, OIDC, etc',
  enum: Object.values(IdentityProviderType),
};

export const IdentityProviderIdentifier: JsonSchema = {
  id: `${__filename}/IdentityProviderIdentifier`,
  type: JsonSchemaType.OBJECT,
  properties: {
    identityProviderId: {
      type: JsonSchemaType.STRING,
      description: 'The id of identity provider',
      ...ID_VALIDATION,
    },
  },
  required: ['identityProviderId'],
};

/**
 * Schema for an identity provider
 */
export const IdentityProvider: JsonSchema = extendSchema(
  {
    id: `${__filename}/IdentityProvider`,
    type: JsonSchemaType.OBJECT,
    properties: {
      type: IdentityProviderTypeSchema,
      name: {
        type: JsonSchemaType.STRING,
        description: 'The name of the identity provider',
        ...NAME_VALIDATION,
      },
      description: {
        type: JsonSchemaType.STRING,
        description: 'A description of the identity provider',
        ...DESCRIPTION_VALIDATION,
      },
      identifiers: {
        type: JsonSchemaType.ARRAY,
        items: {
          type: JsonSchemaType.STRING,
          ...USER_IDENTIFIER_VALIDATION,
        },
        description: 'A list of identity provider identifiers',
      },
      attributeMapping: {
        type: JsonSchemaType.OBJECT,
        description: 'The identity provider attribute mapping',
        additionalProperties: {
          type: JsonSchemaType.STRING,
        },
      },
      enabled: {
        type: JsonSchemaType.BOOLEAN,
        description: 'Specify if the identity provider is enabled or not',
        default: true,
      },
      details: {
        // type: JsonSchemaType.OBJECT,
        description: 'Parameters to configure the identity provider',
        // These will be IDP specific, see here:
        // https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_CreateIdentityProvider.html
        // additionalProperties: true,
      },
    },
    required: ['type', 'name', 'details'],
  },
  IdentityProviderIdentifier,
);

/**
 * Schema for an identity attributes
 */
export const IdentityAttributes: JsonSchema = {
  id: `${__filename}/IdentityAttributes`,
  type: JsonSchemaType.OBJECT,
  properties: {
    attributes: {
      type: JsonSchemaType.ARRAY,
      items: {
        id: `${__filename}/IdentityAttribute`,
        type: JsonSchemaType.OBJECT,
        properties: {
          name: {
            type: JsonSchemaType.STRING,
            description: 'The name of the attribute',
          },
          type: {
            type: JsonSchemaType.STRING,
            description: 'The data type of the attribute',
          },
          required: {
            type: JsonSchemaType.BOOLEAN,
            description: 'Flag that determine if the attribute is required or not',
          },
        },
        required: ['name', 'type', 'required'],
      },
    },
  },
};

/**
 * Schema for an access request for a user to join a group
 */
export const AccessRequestIdentifier: JsonSchema = {
  id: `${__filename}/AccessRequestIdentifier`,
  type: JsonSchemaType.OBJECT,
  properties: {
    groupId: {
      type: JsonSchemaType.STRING,
      description: 'The id of group the user wants access to',
      ...ID_VALIDATION,
    },
    userId: {
      type: JsonSchemaType.STRING,
      description: 'UserId of user requesting access',
      ...USER_IDENTIFIER_VALIDATION,
    },
  },
  required: ['groupId', 'userId'],
};

/**
 * Schema for an access request for a user to join a group
 */
export const AccessRequest: JsonSchema = extendSchema(
  {
    id: `${__filename}/AccessRequest`,
    type: JsonSchemaType.OBJECT,
    properties: {
      message: {
        type: JsonSchemaType.STRING,
        description: 'Access Request Notes',
        ...DESCRIPTION_VALIDATION,
      },
    },
  },
  AccessRequestIdentifier,
);

/**
 * Schema for an access request with action for a user to join a group
 */
export const AccessRequestActionDetails: JsonSchema = {
  id: `${__filename}/AccessRequestActionDetails`,
  type: JsonSchemaType.OBJECT,
  properties: {
    reason: {
      type: JsonSchemaType.STRING,
      description: 'Reasons associated with outcome of the access request',
      ...DESCRIPTION_VALIDATION,
    },
  },
  required: ['reason'],
};
