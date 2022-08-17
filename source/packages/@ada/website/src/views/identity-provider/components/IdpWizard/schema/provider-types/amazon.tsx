/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { COMMON_CLIENT_FIELDS, IdpTypeDefinition, mapFieldsToType } from './common';
import { Icon } from '@material-ui/core';
import { IdentityProviderType } from '@ada/common';
import { LL } from '@ada/strings';

export const IDP_AMAZON: IdpTypeDefinition = {
  type: IdentityProviderType.Amazon,
  icon: <Icon className="fa fa-amazon" />,
  title: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.AMAZON.title(),
  learnMore: {
    text: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.AMAZON.learnMore.text(),
    link: LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.AMAZON.learnMore.link(),
  },
  schemaFields: mapFieldsToType(IdentityProviderType.Amazon, [...COMMON_CLIENT_FIELDS]),
};

export default IDP_AMAZON;
