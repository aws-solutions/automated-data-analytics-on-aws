/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CostContextProvider, useCostContext } from '$views/cost/context';
import { FormField } from 'aws-northstar';
import { ManagedHelpPanel, PageLayout, TabItem, Tabs } from '$northstar-plus';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import AccountCosts from '$views/cost/components/AccountCosts';
import AccountServiceCosts from '$views/cost/components/AccountServiceCosts';
import React, { useMemo } from 'react';
import Select, { SelectOption } from 'aws-northstar/components/Select';

export interface CostRootViewProps {}

export const CostRootView: React.FC<CostRootViewProps> = () => {
  const { LL } = useI18nContext();

  const tabs: TabItem[] = [
    {
      label: LL.VIEW.COST.AccountCosts.label(),
      id: 'account-costs',
      content: <AccountCosts />,
    },
    {
      label: LL.VIEW.COST.ServiceCosts.label(),
      id: 'service-costs',
      content: <AccountServiceCosts />,
    },
  ];

  return (
    <>
      <HelpInfo />
      <CostContextProvider>
        <PageLayout title={LL.VIEW.COST.title()} actionButtons={<DigitDropdown />}>
          <Tabs tabs={tabs} variant="container" />
        </PageLayout>
      </CostContextProvider>
    </>
  );
};

const DigitDropdown: React.FC = () => {
  const { digits, setDigits } = useCostContext();

  const options = useMemo<SelectOption[]>(() => {
    return [2, 3, 4, 5].map((value) => ({ value: String(value), label: `${value} decimals` }));
  }, []);

  return (
    <div style={{ minWidth: 160 }}>
      <FormField label="Precision" controlId="digits">
        <Select
          label="Digits"
          selectedOption={{ value: String(digits) }}
          options={options}
          onChange={(event) => setDigits(parseInt(event.target.value as string))}
        />
      </FormField>
    </div>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.COST.HELP.ROOT.header()}>
      {import('@ada/strings/markdown/view/cost/help.md')}
    </ManagedHelpPanel>
  );
}
