/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Button, Inline } from 'aws-northstar';
import { IdentityProviderTable } from '../../components/Table';
import { ManagedHelpPanel, PageLayout } from '$northstar-plus';
import { OAuthSettings } from '../../components/OAuthSettings';
import { SamlSettings } from '../../components/SAMLSettings';
import { useHistory } from 'react-router-dom';
import { useI18nContext } from '$strings';
import React from 'react';

export interface IdentityProviderRootProps {}

/**
 * Page to show all idps
 */
export const IdentityProviderRootView: React.FC<IdentityProviderRootProps> = () => {
  const { LL } = useI18nContext();
  const history = useHistory();

  return (
    <>
      <HelpInfo />
      <PageLayout
        title={LL.VIEW.IDENTITY_PROVIDER.title()}
        subtitle={LL.VIEW.IDENTITY_PROVIDER.subtitle()}
      >
        <IdentityProviderTable
          actionGroup={
            <Inline>
              <Button variant="primary" onClick={() => history.push('/admin/identity/provider/new')}>
                {LL.ENTITY.IdentityProvider__CREATE()}
              </Button>
            </Inline>
          }
        />

        <OAuthSettings />
        <SamlSettings />
      </PageLayout>
    </>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.IDENTITY_PROVIDER.HELP.ROOT.header()}>
      {import('@ada/strings/markdown/view/identity-provider/help.md')}
    </ManagedHelpPanel>
  );
}
