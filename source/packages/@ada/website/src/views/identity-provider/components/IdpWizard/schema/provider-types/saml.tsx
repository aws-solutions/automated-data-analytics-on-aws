/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Icon } from '@material-ui/core';
import { IdentityProviderType } from '@ada/common';
import { IdpTypeDefinition, METAFILE_FIELDS, mapFieldsToType } from './common';
import { LL } from '@ada/strings';
import { SamlSettings } from '../../../SAMLSettings';
import { componentTypes } from 'aws-northstar/components/FormRenderer';

export const IDP_SAML: IdpTypeDefinition = {
  type: IdentityProviderType.SAML,
  icon: <Icon className="fa fa-user" />,
  title: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.SAML.title(),
  learnMore: {
    text: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.SAML.learnMore.text(),
    link: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.SAML.learnMore.link(),
  },
  schemaFields: mapFieldsToType(IdentityProviderType.SAML, [
    ...METAFILE_FIELDS,
    {
      component: componentTypes.CHECKBOX,
      name: 'details.signOut',
      label: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.SAML.FIELDS.signOut.label(),
    },
    {
      component: componentTypes.CUSTOM,
      name: '_samlSettings',
      label: LL.VIEW.IDENTITY_PROVIDER.SETTINGS.SAML.title(),
      CustomComponent: () => <SamlSettings />,
    }
  ]),
};

export default IDP_SAML;
