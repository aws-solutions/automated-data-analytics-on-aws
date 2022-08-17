/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AmazonProvider, GoogleProvider, IdentityProviderType, OIDCProvider, SAMLProvider } from '@ada/common';
import { COMMON_CLIENT_FIELD_DEFAULTS } from './provider-types/common';
import { CardSelectOption, CustomComponentTypes } from '$common/components';
import { DeepPartial } from '$ts-utils';
import { IdentityProviderDefinitions } from './provider-types';
import { IdentityProviderSummary } from '../../Summary';
import { LL } from '@ada/strings';
import { Link } from 'aws-northstar';
import { WizardStep } from '$northstar-plus';
import { cloneDeep, isNil, omitBy } from 'lodash';
import { componentTypes } from 'aws-northstar/components/FormRenderer/types';
import { identifierToName, nameToIdentifier } from '$common/utils';
import { validatorTypes } from 'aws-northstar/components/FormRenderer';
import React from 'react';
import type {
  IdentityAttribute,
  IdentityProvider,
  IdentityProviderEntity,
  IdentityProviderIdentifier,
  IdentityProviderInput,
} from '@ada/api';

/* eslint-disable sonarjs/no-duplicate-string */

const PREFERRED_USERNAME_ATTRIBUTE = 'preferred_username';

export type FormData = Omit<
  IdentityProviderInput,
  'identityProviderId' | 'details' | 'attributeMapping' | 'enabled'
> & {
  preferredUsername: string;
  attributeMapping: { providerAttribute: string; cognitoAttribute: string }[];

  [IdentityProviderType.Amazon]: { details: AmazonProvider };
  [IdentityProviderType.Google]: { details: GoogleProvider };
  [IdentityProviderType.OIDC]: { details: OIDCProvider };
  [IdentityProviderType.SAML]: { details: SAMLProvider };
};

export const buildSteps = (
  identityProviderId: string | undefined,
  cognitoAttributes: IdentityAttribute[],
): WizardStep[] => {
  const isNew = identityProviderId == null;

  return [
    {
      title: isNew ? LL.ENTITY.IdentityProvider__CREATE() : LL.ENTITY.IdentityProvider__UPDATE(identityProviderId),
      description: LL.VIEW.IDENTITY_PROVIDER.subtitle(),
      fields: [
        {
          component: componentTypes.TEXT_FIELD,
          name: 'name',
          label: LL.ENTITY['IdentityProvider@'].name.label(),
          description: LL.ENTITY['IdentityProvider@'].name.description(),
          isRequired: true,
          isReadOnly: !isNew,
          validate: [
            {
              type: validatorTypes.REQUIRED,
            },
            {
              type: validatorTypes.PATTERN,
              pattern: '^[a-z][a-z0-9]+$',
            },
          ],
        },
        {
          component: componentTypes.TEXT_FIELD,
          name: 'description',
          label: LL.ENTITY['IdentityProvider@'].description.label(),
          description: LL.ENTITY['IdentityProvider@'].description.description(),
          placeholder: LL.ENTITY['IdentityProvider@'].description.placeholder(),
          isRequired: true,
          validate: [
            {
              type: validatorTypes.REQUIRED,
            },
          ],
        },
        {
          component: CustomComponentTypes.STRING_GROUP,
          name: 'identifiers',
          label: LL.ENTITY['IdentityProvider@'].identifiers.label(),
          description: LL.ENTITY['IdentityProvider@'].identifiers.description(),
          isOptional: true,
        },
        {
          component: CustomComponentTypes.CARD_SELECT,
          name: 'type',
          label: LL.VIEW.IDENTITY_PROVIDER.WIZARD.FIELDS.type.label(),
          description: LL.VIEW.IDENTITY_PROVIDER.WIZARD.FIELDS.type.description(),
          isReadOnly: !isNew,
          isRequired: true,
          options: IdentityProviderDefinitions.map(
            (idp): CardSelectOption => ({
              title: idp.title,
              subtitle: (
                <Link href={idp.learnMore.link} target="_blank">
                  {LL.VIEW.IDENTITY_PROVIDER.WIZARD.FIELDS.type.learnMore()}
                </Link>
              ),
              value: idp.type,
              icon: idp.icon,
            }),
          ),
          validate: [
            {
              type: validatorTypes.REQUIRED,
            },
          ],
        },
        ...IdentityProviderDefinitions.flatMap((idp) => {
          return {
            component: componentTypes.SUB_FORM,
            name: idp.type,
            title: idp.title,
            description: idp.description,
            fields: idp.schemaFields,
            condition: {
              when: 'type',
              is: idp.type,
            },
          };
        }),
      ],
    },
    {
      title: LL.ENTITY['IdentityProvider@'].attributeMapping.label(),
      description: LL.ENTITY['IdentityProvider@'].attributeMapping.description(),
      fields: [
        {
          component: componentTypes.TEXT_FIELD,
          name: 'preferredUsername',
          label: LL.ENTITY.IdentityProvider_.ATTRIBUTES.preferredUsername.label(),
          description: LL.ENTITY.IdentityProvider_.ATTRIBUTES.preferredUsername.description(),
          hintText: LL.ENTITY.IdentityProvider_.ATTRIBUTES.preferredUsername.hintText(),
          isRequired: true,
          validate: [
            {
              type: validatorTypes.REQUIRED,
            },
          ],
        },
        {
          component: componentTypes.FIELD_ARRAY,
          name: 'attributeMapping',
          label: LL.VIEW.IDENTITY_PROVIDER.WIZARD.FIELDS.attributeMapping.label(),
          description: LL.VIEW.IDENTITY_PROVIDER.WIZARD.FIELDS.attributeMapping.description(),
          helperText: LL.VIEW.IDENTITY_PROVIDER.WIZARD.FIELDS.attributeMapping.hintText(),
          noItemsMessage: LL.VIEW.IDENTITY_PROVIDER.WIZARD.FIELDS.attributeMapping.emptyText(),
          minItems: 0,
          maxItems: 25,
          fields: [
            {
              component: componentTypes.TEXT_FIELD,
              name: 'providerAttribute',
              label: LL.VIEW.IDENTITY_PROVIDER.WIZARD.FIELDS.attributeMapping.FIELDS.providerAttribute.label(),
              isRequired: true,
              validate: [
                {
                  type: validatorTypes.REQUIRED,
                },
              ],
            },
            {
              component: componentTypes.SELECT,
              name: 'cognitoAttribute',
              label: LL.VIEW.IDENTITY_PROVIDER.WIZARD.FIELDS.attributeMapping.FIELDS.
                cognitoAttribute.label(),
              placeholder: LL.VIEW.IDENTITY_PROVIDER.WIZARD.FIELDS.attributeMapping.FIELDS.
                cognitoAttribute.placeholder(),
              isRequired: true,
              options: cognitoAttributes
                .filter((q) => !['sub', 'identities', PREFERRED_USERNAME_ATTRIBUTE].includes(q.name!))
                .map(({ name }) => ({
                  label: name,
                  value: name,
                })),
              validate: [
                {
                  type: validatorTypes.REQUIRED,
                },
              ],
            },
          ],
        },
      ],
    },
    {
      title: LL.VIEW.wizard.STEP.review.title(),
      fields: [
        {
          component: componentTypes.REVIEW,
          name: 'review',
          Template: ({ data }: { data: FormData }) => {
            const input = formDataToInput(data, true);

            return <IdentityProviderSummary identityProvider={input} />;
          },
        },
      ],
    },
  ];
};

export const getInitialValues = (idp: IdentityProvider | undefined): DeepPartial<FormData> => {
  return entityToFormData(idp);
};

const DEFAULT_FORM_DATA: DeepPartial<FormData> = {
  // https://developer.amazon.com/docs/login-with-amazon/requesting-scopes-as-essential-voluntary.html
  [IdentityProviderType.Amazon]: { details: { scopes: ['profile'] } },
  [IdentityProviderType.Google]: { details: COMMON_CLIENT_FIELD_DEFAULTS },
  [IdentityProviderType.OIDC]: { details: COMMON_CLIENT_FIELD_DEFAULTS },
  [IdentityProviderType.SAML]: { details: {} },
};

export function entityToFormData(entity?: IdentityProviderEntity): DeepPartial<FormData> {
  const defaults = cloneDeep(DEFAULT_FORM_DATA);
  if (entity == null) return defaults;

  entity = cloneDeep(entity);

  const attributeMapping: IdentityProviderEntity['attributeMapping'] = entity.attributeMapping || {};
  const preferredUsername: string = attributeMapping[PREFERRED_USERNAME_ATTRIBUTE];
  if (PREFERRED_USERNAME_ATTRIBUTE in attributeMapping) delete attributeMapping[PREFERRED_USERNAME_ATTRIBUTE];

  const attributeMappingList: FormData['attributeMapping'] = Object.entries(attributeMapping).map(
    ([providerAttribute, cognitoAttribute]) => ({ providerAttribute, cognitoAttribute }),
  );

  const details: any = entity.details || {};

  return {
    ...defaults,
    name: identifierToName(entity.identityProviderId),
    type: entity.type,
    description: entity.description,
    preferredUsername,
    identifiers: entity.identifiers || [],
    attributeMapping: attributeMappingList,

    ...(entity.type && entity.details ? { [entity.type]: { details } } : {}),
  };
}

export function formDataToInput(
  formData: FormData,
  preview?: boolean,
): IdentityProviderInput & IdentityProviderIdentifier {
  formData = cloneDeep(formData);
  const details = omitBy(formData[formData.type].details, isNil);
  delete formData[formData.type];

  if (details.metadataFile?.content) {
    if (preview) {
      details.metadataFile = details.metadataFile.content;
    } else {
      details.metadataFile = btoa(details.metadataFile.content);
    }
  }

  const attributeMapping = (formData.attributeMapping || []).reduce(
    (mapping, attr) => {
      return {
        ...mapping,
        [attr.cognitoAttribute]: attr.providerAttribute,
      };
    },
    {
      [PREFERRED_USERNAME_ATTRIBUTE]: formData.preferredUsername,
    } as IdentityProviderInput['attributeMapping'],
  );

  return {
    identityProviderId: nameToIdentifier(formData.name),
    name: formData.name,
    description: formData.description,
    type: formData.type,
    identifiers: formData.identifiers,
    attributeMapping,
    details,
  };
}
