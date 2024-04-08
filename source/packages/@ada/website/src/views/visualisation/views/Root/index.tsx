/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { Button, Inline, Text } from 'aws-northstar';
import { LLSafeHtmlString } from '$strings';
import { ManagedHelpPanel, PageLayout, useNotificationContext } from '$northstar-plus';
import { apiHooks } from '$api';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import React, { useCallback, useState } from 'react';

export interface VisualisationRootViewProps {}

export const VisualisationRootView: React.FC<VisualisationRootViewProps> = () => {
  const { LL } = useI18nContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const { addSuccess, addError } = useNotificationContext();

  const onError = useCallback((error) => {
    setIsProcessing(false);
    addError({
      header: LL.VIEW.VISUALISATION.NOTIFY.error.header(),
      content: error.message,
    });
  }, []);

  const onSuccess = useCallback(() => {
    setIsProcessing(false);
    addSuccess({
      header: LL.VIEW.VISUALISATION.NOTIFY.success.header(),
      dismissible: false,
    });
  }, []);

  const [startDeployment] = apiHooks.usePostAdministrationDeploySuperset({
    onError,
    onSuccess,
  });

  const handleStartDeployment = useCallback(async () => {
    await startDeployment({});
  }, [startDeployment]);

  return (
    <>
      <HelpInfo />
      <PageLayout title={LL.VIEW.VISUALISATION.title()}>
        <Inline spacing="m">
          <Text variant="p">
            <LLSafeHtmlString string="VIEW.VISUALISATION.htmlBody" />
          </Text>
        </Inline>
        <Button variant="primary" onClick={handleStartDeployment} disabled={isProcessing}>
          Deploy Apache Superset
        </Button>
      </PageLayout>
    </>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.VISUALISATION.HELP.ROOT.header()}>
      {import('@ada/strings/markdown/view/visualisation/help.md')}
    </ManagedHelpPanel>
  );
};
