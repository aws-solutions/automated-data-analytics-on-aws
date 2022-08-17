/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ManagedHelpPanel } from '$northstar-plus';
import { CreateDataProductWizard as Wizard } from './components/Wizard';
import { useI18nContext } from '$strings';
import { useOperationDeniedRedirect } from '$api/hooks/permissions';
import { useParams } from 'react-router-dom';
import React from 'react';

export interface CreateDataProductViewProps {}

export const CreateDataProductView: React.FC<CreateDataProductViewProps> = () => {
  const { domainId } = useParams<{ domainId?: string }>();
  const allowed = useOperationDeniedRedirect('/', 'putDataProductDomainDataProduct');

  if (allowed !== true) {
    return null;
  }

  return (
    <>
      <HelpInfo />
      <Wizard domainId={domainId} />
    </>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.DATA_PRODUCT.HELP.CREATE.header()}>
      {import('@ada/strings/markdown/view/data-product/help.create.md')}
    </ManagedHelpPanel>
  );
}
