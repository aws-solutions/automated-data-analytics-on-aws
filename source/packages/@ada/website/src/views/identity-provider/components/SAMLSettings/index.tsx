/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { LL } from '@ada/strings';
import { RuntimeConfig } from '../../../../runtime-config';
import { SummaryRenderer, SummarySection } from '$northstar-plus';
import React, { useMemo } from 'react';

export const SamlSettings: React.FC = () => {
  const summarySections = useMemo<SummarySection[]>(() => {
    return [
      {
        title: LL.VIEW.IDENTITY_PROVIDER.SETTINGS.SAML.title(),
        id: 'saml',
        options: {
          renderLabel: (label) => label
        },
        properties: {
          [LL.VIEW.IDENTITY_PROVIDER.SETTINGS.SAML.callbackUrl()]: `https://${RuntimeConfig.oauthDomain}/saml2/idpresponse`,
          [LL.VIEW.IDENTITY_PROVIDER.SETTINGS.SAML.acsUrl()]: `https://${RuntimeConfig.oauthDomain}/saml2/idpresponse`,
          [LL.VIEW.IDENTITY_PROVIDER.SETTINGS.SAML.audienceUri()]: `urn:amazon:cognito:sp:${RuntimeConfig.userPoolId}`,
        },
      },
    ];
  }, []);

  return <SummaryRenderer sections={summarySections} />;
};
