/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DeleteIdentityProviderButton } from '$views/identity-provider/components/DeleteIdentityProvider';
import { ErrorAlert } from '$common/components/errors';
import { IdentityProviderSummary } from '../../components/Summary';
import { Inline, Stack } from 'aws-northstar';
import { ManagedHelpPanel, Skeletons } from '$northstar-plus';
import { OAuthSettings } from '../../components/OAuthSettings';
import { SamlSettings } from '../../components/SAMLSettings';
import { apiHooks } from '$api';
import { useI18nContext } from '$strings';
import { useParams } from 'react-router-dom';
import React, { useMemo } from 'react';

export interface IdentityProviderDetailViewProps {}

export const IdentityProviderDetailView: React.FC<IdentityProviderDetailViewProps> = () => {
  const { LL } = useI18nContext();
  const { identityProviderId } = useParams<{ identityProviderId: string }>();

  const [idp, queryInfo] = apiHooks.useIdentityProvider({ identityProviderId });

  const actionGroup = useMemo<React.ReactNode>(() => {
    if (idp) {
      return (
        <Inline>
          <DeleteIdentityProviderButton identityProvider={idp} />
        </Inline>
      );
    }

    return null;
  }, [idp]);

  if (queryInfo.isError) {
    return <ErrorAlert
      header={LL.ENTITY.IdentityProvider__FAILED_TO_FETCH(identityProviderId)}
      error={queryInfo.error}
    />;
  }

  if (idp == null || queryInfo.isLoading) {
    return <Skeletons.Summary />;
  }

  return (
    <>
      <HelpInfo />
      <Stack>
        <IdentityProviderSummary
          identityProvider={idp}
          title={idp.name}
          subtitle={LL.ENTITY.IdentityProvider()}
          actionGroup={actionGroup}
        />
        <OAuthSettings />
        <SamlSettings />
      </Stack>
    </>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.IDENTITY_PROVIDER.HELP.DETAIL.header()}>
      {import('@ada/strings/markdown/view/identity-provider/help.detail.md')}
    </ManagedHelpPanel>
  );
}
