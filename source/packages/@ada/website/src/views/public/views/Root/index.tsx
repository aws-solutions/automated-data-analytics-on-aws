/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { LandingPage } from '../../components/LandingPage';
import { ManagedHelpPanel } from '$northstar-plus';
import { useI18nContext } from '$strings';

export interface PublicRootViewProps {}

export const PublicRootView: React.FC<PublicRootViewProps> = () => {
  return (
    <>
      <HelpInfo />
      <LandingPage />
    </>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.PUBLIC.HELP.ROOT.header()}>
      {import('@ada/strings/markdown/view/public/help.md')}
    </ManagedHelpPanel>
  );
}
