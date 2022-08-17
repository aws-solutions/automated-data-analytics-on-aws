/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { COMMON_CLIENT_FIELDS, IdpTypeDefinition, mapFieldsToType } from './common';
import { Icon } from '@material-ui/core';
import { IdentityProviderType } from '@ada/common';
import { LL } from '@ada/strings';

export const IDP_GOOGLE: IdpTypeDefinition = {
  type: IdentityProviderType.Google,
  icon: <Icon className="fa fa-google" />,
  title: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.GOOGLE.title(),
  learnMore: {
    text: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.GOOGLE.learnMore.text(),
    link: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.GOOGLE.learnMore.link(),
  },
  schemaFields: mapFieldsToType(IdentityProviderType.Google, [...COMMON_CLIENT_FIELDS]),
};

export default IDP_GOOGLE;
