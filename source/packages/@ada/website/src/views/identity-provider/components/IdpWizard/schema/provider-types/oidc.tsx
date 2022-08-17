/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AttributeRequestMethod, IdentityProviderType } from '@ada/common';
import { COMMON_CLIENT_FIELDS, IdpTypeDefinition, mapFieldsToType } from './common';
import { Icon } from '@material-ui/core';
import { LL } from '@ada/strings';
import { OAuthSettings } from '../../../OAuthSettings';
import { componentTypes, validatorTypes } from 'aws-northstar/components/FormRenderer';

export const IDP_OIDC: IdpTypeDefinition = {
  type: IdentityProviderType.OIDC,
  icon: <Icon className="fa fa-openid" />,
  title: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.title(),
  learnMore: {
    text: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.learnMore.text(),
    link: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.learnMore.link(),
  },
  schemaFields: mapFieldsToType(IdentityProviderType.OIDC, [
    {
      component: componentTypes.TEXT_FIELD,
      name: 'details.issuer',
      label: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.FIELDS.issuer.label(),
      description: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.FIELDS.issuer.description(),
      validate: [
        {
          type: validatorTypes.REQUIRED,
        },
        {
          type: validatorTypes.URL,
        },
      ],
    },
    ...COMMON_CLIENT_FIELDS,
    {
      component: componentTypes.SELECT,
      name: 'details.attributeRequestMethod',
      label: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.FIELDS.attributeRequestMethod.label(),
      description: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.FIELDS.attributeRequestMethod.description(),
      options: Object.entries(AttributeRequestMethod).map(([key, value]) => ({
        label: key,
        value: value,
      })),
      validate: [
        {
          type: validatorTypes.REQUIRED,
        },
      ],
    },
    {
      component: componentTypes.EXPANDABLE_SECTION,
      name: 'details',
      title: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.FIELDS.advanced.label(),
      description: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.FIELDS.advanced.description(),
      variant: 'container',
      fields: [
        {
          component: componentTypes.TEXT_FIELD,
          name: 'authorizeUrl',
          label: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.FIELDS.authorizeUrl.label(),
          description: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.FIELDS.authorizeUrl.description(),
          validate: [
            {
              type: validatorTypes.URL,
            },
          ],
        },
        {
          component: componentTypes.TEXT_FIELD,
          name: 'tokenUrl',
          label: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.FIELDS.tokenUrl.label(),
          description: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.FIELDS.tokenUrl.description(),
          validate: [
            {
              type: validatorTypes.URL,
            },
          ],
        },
        {
          component: componentTypes.TEXT_FIELD,
          name: 'attributesUrl',
          label: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.FIELDS.attributesUrl.label(),
          description: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.FIELDS.attributesUrl.description(),
          validate: [
            {
              type: validatorTypes.URL,
            },
          ],
        },
        {
          component: componentTypes.TEXT_FIELD,
          name: 'jwksUri',
          label: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.FIELDS.jwksUri.label(),
          description: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.OIDC.FIELDS.jwksUri.description(),
          validate: [
            {
              type: validatorTypes.URL,
            },
          ],
        },
      ],
    },
    {
      component: componentTypes.CUSTOM,
      name: '_oAuthSettings',
      label: LL.VIEW.IDENTITY_PROVIDER.SETTINGS.OAUTH.title(),
      CustomComponent: () => <OAuthSettings />,
    }
  ]),
};

export default IDP_OIDC;
