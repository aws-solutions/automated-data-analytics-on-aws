/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { IdpWizard } from '../../components/IdpWizard';
import { ManagedHelpPanel } from '$northstar-plus';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import React from 'react';

export const CreateIdentityProviderView: React.FC = () => {
  return (
    <>
      <HelpInfo />
      <IdpWizard />
    </>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.IDENTITY_PROVIDER.HELP.CREATE.header()}>
      {import('@ada/strings/markdown/view/identity-provider/help.create.md')}
    </ManagedHelpPanel>
  );
}
