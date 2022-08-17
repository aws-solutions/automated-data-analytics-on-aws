/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { IdentityProvider } from '@ada/api';
import { StatusIndicator } from 'aws-northstar';
import { SummaryRenderer } from '$northstar-plus/components/SummaryRenderer';
import { compact, startCase } from 'lodash';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import React from 'react';

/* eslint-disable sonarjs/no-duplicate-string */

export const IdentityProviderSummary: React.FC<{
  identityProvider: IdentityProvider;
  title?: string;
  subtitle?: string;
  actionGroup?: React.ReactNode;
}> = ({ identityProvider: idp, title, subtitle, actionGroup }) => {
  const { LL } = useI18nContext();
  return (
    <SummaryRenderer
      options={{ renderLabel: (label) => label, }}
      sections={[
        {
          title,
          subtitle,
          actionGroup,
          properties: [
            {
              label: LL.ENTITY['IdentityProvider@'].name.label(),
              value: idp.name,
            },
            {
              label: LL.ENTITY['IdentityProvider@'].description.label(),
              value: idp.description,
            },
            {
              label: LL.ENTITY['IdentityProvider@'].identifiers.label(),
              value: idp.identifiers,
            },
            {
              label: LL.ENTITY['IdentityProvider@'].type.label(),
              value: idp.type,
            },
            ...compact([
              idp.enabled == null
                ? null
                : {
                    label: LL.VIEW.IDENTITY_PROVIDER.STATUS.label(),
                    value: (
                      <StatusIndicator statusType={idp.enabled ? 'positive' : 'negative'}>
                        {idp.enabled
                          ? LL.VIEW.IDENTITY_PROVIDER.STATUS.enabled()
                          : LL.VIEW.IDENTITY_PROVIDER.STATUS.disabled()
                        }
                      </StatusIndicator>
                    ),
                  },
            ]),
          ],
        },
        {
          title: LL.VIEW.IDENTITY_PROVIDER.SUMMARY.DETAILS.title(idp.type),
          options: {
            renderLabel: (label) => {
              const typeKey = idp.type.toUpperCase();
              if (label in LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.COMMON.FIELDS) {
                // @ts-ignore
                return LL.VIEW.IDENTITY_PROVIDER.PROVIDERS.COMMON.FIELDS[label as any]?.label() || startCase(label);
              } else if (typeKey in LL.VIEW.IDENTITY_PROVIDER.PROVIDERS) {
                // @ts-ignore
                return LL.VIEW.IDENTITY_PROVIDER.PROVIDERS[typeKey as any]?.FIELDS[label]?.label() || startCase(label);
              } else {
                return startCase(label);
              }
            }
          },
          properties: idp.details as any,
        },
        {
          title: LL.ENTITY['IdentityProvider@'].attributeMapping.label(),
          properties: idp.attributeMapping,
        },
      ]}
    />
  );
};
