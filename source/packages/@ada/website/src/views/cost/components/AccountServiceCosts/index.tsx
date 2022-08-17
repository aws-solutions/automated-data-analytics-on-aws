/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

/**
 * Renders the table view for a list of validation results.
 */
import React from 'react';

import Box from 'aws-northstar/layouts/Box';
import Card from 'aws-northstar/components/Card';
import ProgressBar from 'aws-northstar/components/ProgressBar';
import Table from 'aws-northstar/components/Table';

import { GetCostOutput } from '@ada/api';
import { useCostContext } from '../../context';
import Heading from 'aws-northstar/components/Heading';
import Inline from 'aws-northstar/layouts/Inline';
import Stack from 'aws-northstar/layouts/Stack';
import _ from 'lodash';

export interface AccountCostsProps {}

const getLang = () => navigator.language || (navigator.languages || ['en'])[0];

const getNumberOfDays = (cost: GetCostOutput) => cost && _(cost.resultsByTime).size();

const getServiceCosts = (costs: GetCostOutput) => {
  if (costs) {
    let retVal: { [key: string]: { cost: number; usage: number; service: string } } = {};
    _(costs.resultsByTime).forEach((result) => {
      let cost = 0;
      let usage = 0;
      let service: string;
      _(result.groups).forEach((group) => {
        cost = parseFloat(group.metrics?.blendedCost?.amount || '0');
        usage = parseFloat(group.metrics?.UsageQuantity?.amount || '0');
        service = (group.keys || [])[0];

        if (cost && service) {
          if (!retVal[service]) {
            retVal = { ...retVal, [service]: { cost, usage, service } };
          } else {
            retVal[service].cost += cost;
            retVal[service].usage += usage;
            retVal[service].service = service;
          }
        }
      });
    });
    return retVal;
  }
  return {};
};

const columnDefinitions = (totalCost: number, numberOfDays: number, priceFormat: Intl.NumberFormatOptions) => [
  {
    id: 'service',
    width: 350,
    Header: 'Service',
    accessor: 'service',
  },
  {
    id: 'costs',
    width: 150,
    Header: 'Cost (USD)',
    accessor: 'cost',
    Cell: ({ row }: any) => {
      if (row && row.original) {
        return row.original.cost.toLocaleString(getLang(), priceFormat);
      }
      return 'null';
    },
  },
  {
    id: 'percentOfTotal',
    width: 450,
    Header: 'Percent of Spend',
    Cell: ({ row }: any) => {
      if (row && row.original) {
        const total: number = totalCost;
        const percentage: number = Number(row.original.cost / total) * 100;
        if (Number.isNaN(percentage)) {
          return '';
        }
        return percentage > 0.1 ? (
          <div style={{ maxWidth: 350 }}>
            <ProgressBar value={Number(percentage.toFixed(2))} />
          </div>
        ) : (
          ''
        );
      }
      return 'null';
    },
  },
  {
    id: 'costPerDay',
    width: 150,
    Header: 'Cost Per Day (USD)',
    Cell: ({ row }: any) => {
      if (row && row.original) {
        return (row.original.cost / numberOfDays).toLocaleString(getLang(), priceFormat);
      }
      return 'null';
    },
  },
  {
    id: 'usage',
    width: 250,
    Header: 'Service Usage',
    accessor: 'usage',
    Cell: ({ row }: any) => {
      if (row && row.original) {
        return row.original.usage.toLocaleString(getLang(), {});
      }
      return 'null';
    },
  },
];

const AccountServiceCosts: React.FC<AccountCostsProps> = () => {
  const { costs, isFetching, priceFormat } = useCostContext();

  const serviceCosts = getServiceCosts(costs);
  const numberOfDays = getNumberOfDays(costs);

  const top3Services = _(serviceCosts)
    .sortBy((value) => -value.cost)
    .take(3)
    .value();

  const top3UsedServices = _(serviceCosts)
    .sortBy((value) => -value.usage)
    .take(3)
    .value();

  const totalCost = _(serviceCosts)
    .map((value) => value.cost)
    .sum();

  const numberOfServices = _.size(serviceCosts);

  return (
    <Stack>
      <Inline>
        <Box width="350px">
          <Card title="Total Cost" subtitle={`Over ${numberOfDays} days for ${numberOfServices} services`}>
            <Heading variant="h1">{`${totalCost.toLocaleString(getLang(), priceFormat)}`}</Heading>
          </Card>
        </Box>
        <Box width="350px">
          <Card title="Services Used" subtitle={`Over ${numberOfDays} days`}>
            <Heading variant="h1">{`${numberOfServices}`}</Heading>
          </Card>
        </Box>
        <Box width="350px">
          <Card title="Most Used Service" subtitle={`Over ${numberOfDays} days`}>
            <Heading variant="h1">{`${_(top3UsedServices[0]?.service || '-').truncate({
              length: 20,
            })}`}</Heading>
          </Card>
        </Box>
        <Box width="350px">
          <Card title="Most Costly Service" subtitle={`Over ${numberOfDays} days`}>
            <Heading variant="h1">{`${_(top3Services[0]?.service || '-').truncate({
              length: 20,
            })}`}</Heading>
          </Card>
        </Box>
      </Inline>
      <Table
        columnDefinitions={columnDefinitions(totalCost, numberOfDays, priceFormat) as any}
        items={_(serviceCosts)
          .map((value, key) => {
            return { cost: value.cost, service: key, usage: value.usage };
          })
          .value()}
        defaultPageSize={30}
        disableRowSelect
        pageSizes={[30, 60, 90]}
        sortBy={[{ id: 'costs', desc: true }]}
        loading={isFetching}
      />
    </Stack>
  );
};

export default AccountServiceCosts;
