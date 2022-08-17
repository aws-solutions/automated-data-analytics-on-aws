/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

/**
 * Renders error message for Account Costs
 */

import { Alert, Container, ExpandableSection, Link, Stack, Text } from 'aws-northstar';
import React from 'react';

interface AccountCostsErrorProps {
  error: string;
}

// eslint-disable-next-line handle-callback-err
export const AccountCostsError: React.FC<AccountCostsErrorProps> = () => (
  <Container>
    <Stack spacing="s">
      <Alert type="warning">
        <Text variant="p">
          It looks like we cannot access costs for this account. If you are the account owner, please make sure that{' '}
          <b>AWS Cost Explorer</b> and the <i>Cost allocation tag</i> <b>Application</b> are enabled.
        </Text>
      </Alert>

      <HowToEnableCostExplorer />

      <HowToEnableApplicationTag />

      {/* TODO: add github issue for reporting cost issues */}
      {/* <Text>
				If the error persists, open a{' '}
				<Link href="" target="_blank">
					ticket
				</Link>
				, and provide this error message: <em>{error}</em>
			</Text> */}
    </Stack>
  </Container>
);

export default AccountCostsError;

export const ZeroCostWarning: React.FC = () => (
  <Alert type="warning" dismissible>
    <Text variant="p">
      Looks like we cannot calculate cost for this account. If you are the account owner, please make sure that the{' '}
      <i>Cost allocation tag</i> <b>Application</b> is enabled.
    </Text>
    <ExpandableSection header="How to?">
      <HowToEnableApplicationTag />
    </ExpandableSection>
  </Alert>
);

export const HowToEnableCostExplorer: React.FC = () => {
  return (
    <Container title="How to enable AWS Cost Explorer">
      <ol>
        <li>Log into the AWS console</li>
        <li>
          Open{' '}
          <Link href="https://console.aws.amazon.com/cost-management/home" target="_blank" forceExternal>
            AWS Cost Explorer
          </Link>
        </li>
        <li>AWS Cost Explorer will automatically become enabled upon navigating to this page</li>
      </ol>
      <Alert type="info">May take up to 24 hours to show up after enabling</Alert>
    </Container>
  );
};

export const HowToEnableApplicationTag: React.FC = () => {
  return (
    <Container title="How to enable Application tag">
      <ol>
        <li>Log into the AWS console</li>
        <li>
          Open{' '}
          <Link href="https://console.aws.amazon.com/billing/home?#/tags" target="_blank" forceExternal>
            Cost allocation tags
          </Link>
        </li>
        <li>
          Select <b>Application</b> tag and click <i>Activate</i>
        </li>
      </ol>
    </Container>
  );
};
