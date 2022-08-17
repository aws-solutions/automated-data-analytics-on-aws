/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { LL } from '@ada/strings';
import { RuntimeConfig } from '../../../../runtime-config';
import { SummaryRenderer, SummarySection } from '$northstar-plus';
import React, { useMemo } from 'react';

export const OAuthSettings: React.FC = () => {
  const summarySections = useMemo<SummarySection[]>(() => {
    return [
      {
        title: LL.VIEW.IDENTITY_PROVIDER.SETTINGS.OAUTH.title(),
        id:'oauth',
        properties: {
          [LL.VIEW.IDENTITY_PROVIDER.SETTINGS.OAUTH.domain()]: `https://${RuntimeConfig.oauthDomain}`,
          [LL.VIEW.IDENTITY_PROVIDER.SETTINGS.OAUTH.callbackUrl()]: `https://${RuntimeConfig.oauthDomain}/oauth2/idpresponse`,
        },
      }
    ];
  }, []);

  return <SummaryRenderer sections={summarySections} />;
};
