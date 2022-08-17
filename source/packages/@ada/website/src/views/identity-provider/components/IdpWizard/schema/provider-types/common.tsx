/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { BaseProvider, IdentityProviderType } from '@ada/common';
import { CustomComponentTypes } from '$common/components';
import { Field, componentTypes, validatorTypes } from 'aws-northstar/components/FormRenderer';
import { LL } from '@ada/strings';

export interface IdpTypeDefinition {
  type: IdentityProviderType;
  icon: React.ReactElement;
  title: string;
  description?: string;
  learnMore: {
    text: string;
    link: string;
  };
  schemaFields: Field[];
}

export function mapFieldCondition(type: IdentityProviderType, condition: Field['condition']): Field['condition'] {
  const typeCondition: Field['condition'] = {
    when: 'type',
    is: type,
  };

  if (condition == null) {
    return typeCondition;
  }

  condition = Array.isArray(condition) ? condition : [condition];

  return [
    typeCondition,
    ...condition.map((v) => ({
      ...v,
      when: `${type}.${v.when}`,
    })),
  ];
}

export function mapFieldsToType(type: IdentityProviderType, fields: Field[]): Field[] {
  return fields.map((field): Field => {
    return {
      ...field,
      name: `${type}.${field.name}`,
      condition: mapFieldCondition(type, field.condition),
    };
  });
}

export const FIELD_CLIENT_ID: Field = {
  component: componentTypes.TEXT_FIELD,
  name: 'details.clientId',
  label: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.COMMON.FIELDS.clientId.label(),
  description: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.COMMON.FIELDS.clientId.description(),
  isRequired: true,
  validate: [
    {
      type: validatorTypes.REQUIRED,
    },
  ],
};

export const FIELD_CLIENT_SECTRET: Field = {
  component: componentTypes.TEXT_FIELD,
  type: 'password',
  name: 'details.clientSecret',
  label: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.COMMON.FIELDS.clientSecret.label(),
  description: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.COMMON.FIELDS.clientSecret.description(),
  optional: true,
};

export const FIELD_SCOPES: Field = {
  component: CustomComponentTypes.STRING_GROUP,
  name: 'details.scopes',
  label: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.COMMON.FIELDS.scopes.label(),
  description: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.COMMON.FIELDS.scopes.description(),
  isRequired: true,
  validate: [
    {
      type: validatorTypes.REQUIRED,
    },
  ],
};

export const COMMON_CLIENT_FIELDS: Field[] = [FIELD_CLIENT_ID, FIELD_CLIENT_SECTRET, FIELD_SCOPES];

export const COMMON_CLIENT_FIELD_DEFAULTS: Partial<BaseProvider> = {
  scopes: ['openid', 'email', 'profile'],
};

export const METAFILE_FIELDS: Field[] = [
  {
    component: componentTypes.SELECT,
    name: '_urlOrFileSelect',
    label: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.COMMON.FIELDS._urlOrFileSelect.label(),
    description: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.COMMON.FIELDS._urlOrFileSelect.description(),
    options: [
      {
        label: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.COMMON.FIELDS._urlOrFileSelect.OPTIONS.File(),
        value: 'File',
      },
      {
        label: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.COMMON.FIELDS._urlOrFileSelect.OPTIONS.Link(),
        value: 'Link',
      },
    ],
    isRequired: true,
    validate: [
      {
        type: validatorTypes.REQUIRED,
      },
    ],
  },
  {
    component: componentTypes.TEXT_FIELD,
    name: 'details.metadataURL',
    label: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.COMMON.FIELDS.metadataURL.label(),
    description: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.COMMON.FIELDS.metadataURL.description(),
    condition: {
      when: '_urlOrFileSelect',
      is: 'Link',
    },
    validate: [
      {
        type: validatorTypes.URL,
      },
    ],
  },
  {
    component: CustomComponentTypes.FILE_UPLOAD,
    name: 'details.metadataFile',
    parseFileStructure: true,
    label: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.COMMON.FIELDS.metadataFile.label(),
    description: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.COMMON.FIELDS.metadataFile.description(),
    accept: ['.xml'],
    condition: {
      when: '_urlOrFileSelect',
      is: 'File',
    },
  },
];
