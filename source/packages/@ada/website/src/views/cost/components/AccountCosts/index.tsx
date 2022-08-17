/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

/**
 * Renders the table view for a list of validation results.
 */
import Box from 'aws-northstar/layouts/Box';
import Card from 'aws-northstar/components/Card';
import ProgressBar from 'aws-northstar/components/ProgressBar';
import React, { Fragment } from 'react';
import Table from 'aws-northstar/components/Table';

import LineChart, { Line } from 'aws-northstar/charts/LineChart';

import { GetCostOutput } from '@ada/api';
import { useCostContext } from '../../context';
import Button from 'aws-northstar/components/Button';
import ExpandableSection from 'aws-northstar/components/ExpandableSection';
import Heading from 'aws-northstar/components/Heading';
import Inline from 'aws-northstar/layouts/Inline';
import Stack from 'aws-northstar/layouts/Stack';
import _ from 'lodash';

export interface AccountCostsProps {}

const EMPTY_VALUE = '-';

let highestCost: { date: string; cost: number } = { date: '', cost: 0 };

export const findTotalCost = (cost: GetCostOutput) =>
  cost &&
  _(cost.resultsByTime)
    .map((result) => {
      const _cost = _(result.groups)
        .map((group) => parseFloat(group.metrics?.blendedCost?.amount || '0'))
        .sum();
      if (_cost > highestCost.cost && result.timePeriod?.start)
        highestCost = { date: result.timePeriod.start, cost: _cost };
      return _cost;
    })
    .sum();

const getGraphData = (cost: GetCostOutput) => {
  return (
    cost &&
    _(cost.resultsByTime)
      .map((result) => {
        const dailyCost = _(result.groups)
          .map((group) => parseFloat(group.metrics?.blendedCost?.amount || '0'))
          .sum();
        return { name: result.timePeriod?.start, value: dailyCost.toPrecision(4) };
      })
      .value()
  );
};

const getNumberOfDays = (cost: GetCostOutput) => cost && _(cost.resultsByTime).size();

const columnDefinitions = (totalCost: number, priceFormat: Intl.NumberFormatOptions) => [
  {
    id: 'date',
    width: 150,
    Header: 'Date',
    accessor: 'timePeriod.start',
  },
  {
    id: 'costs',
    width: 150,
    Header: 'Cost (USD)',
    accessor: 'cost',
    Cell: ({ row }: any) => {
      if (row && row.original) {
        return _(row.original.groups)
          .map((group) => parseFloat(group.metrics.blendedCost.amount))
          .sum()
          .toLocaleString(getLang(), priceFormat);
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
        const costArray = _(row.original.groups).map((group) => {
          return parseFloat(group.metrics.blendedCost.amount);
        });
        const dailyTotal: number = _(costArray).sum();
        const dailyPercentage: number = parseFloat((Number(dailyTotal / totalCost) * 100).toFixed(2));
        if (Number.isNaN(dailyPercentage) || dailyPercentage <= 0) {
          return EMPTY_VALUE;
        }
        return (
          <div style={{ maxWidth: 350 }}>
            <ProgressBar value={dailyPercentage} />
          </div>
        );
      }
      return EMPTY_VALUE;
    },
  },
  {
    id: 'serviceSplit',
    width: 400,
    Header: 'Service Split',
    Cell: ({ row }: any) => {
      if (row && row.original && row.original.groups.length) {
        const content: any = row.original.groups.map((group: any) => {
          return `${group.keys[0]} ${parseFloat(group.metrics.blendedCost.amount).toLocaleString(
            getLang(),
            priceFormat,
          )}`;
        });
        return (
          <ExpandableSection
            header={`Services (${content.length})`}
            expanded={row.isExpanded}
            onChange={() => row.toggleRowExpanded()}
          >
            <Stack spacing="xs">
              {content.map((el: string, i: number) => (
                <Fragment key={i}>{el}</Fragment>
              ))}
            </Stack>
          </ExpandableSection>
        );
      }
      return EMPTY_VALUE;
    },
  },
];
const getLang = () => navigator.language || (navigator.languages || ['en'])[0];

const AccountCosts: React.FC<AccountCostsProps> = () => {
  const { costs, startDate, endDate, isFetching, days, handleDaysSelection, priceFormat } = useCostContext();

  const totalCost = findTotalCost(costs);
  const numberOfDays = getNumberOfDays(costs);
  const graphData = getGraphData(costs);

  return (
    <Stack>
      <Box width="100%">
        <Card title="Time Travel">
          <Inline>
            <Button variant={days === 30 ? 'primary' : 'normal'} onClick={(e) => handleDaysSelection(e, 30)}>
              Last 30 days
            </Button>
            <Button variant={days === 60 ? 'primary' : 'normal'} onClick={(e) => handleDaysSelection(e, 60)}>
              Last 60 days
            </Button>
            <Button variant={days === 90 ? 'primary' : 'normal'} onClick={(e) => handleDaysSelection(e, 90)}>
              Last 90 days
            </Button>
          </Inline>
        </Card>
      </Box>

      <Inline>
        <Box width="350px">
          <Card title="Total Cost" subtitle={`Over ${numberOfDays} days`}>
            <Heading variant="h1">{`${totalCost.toLocaleString(getLang(), priceFormat)}`}</Heading>
          </Card>
        </Box>
        <Box width="350px">
          <Card title="Average Cost per Day" subtitle={`Over ${numberOfDays} days`}>
            <Heading variant="h1">{`${(totalCost / numberOfDays).toLocaleString(getLang(), priceFormat)}/day`}</Heading>
          </Card>
        </Box>
        <Box width="350px">
          <Card title="Highest Cost Day" subtitle={`Occured on ${highestCost.date}`}>
            <Heading variant="h1">{`${highestCost.cost.toLocaleString(getLang(), priceFormat)}`}</Heading>
          </Card>
        </Box>
        <Box width="700px">
          <Card title="Spend per Day" subtitle={`Over ${numberOfDays} days`}>
            <LineChart width={650} height={20} data={graphData}>
              <Line dataKey="value" dot={false} />
            </LineChart>
          </Card>
        </Box>
      </Inline>
      <Table
        tableTitle={`Daily costs from ${startDate.format('YYYY-MM-DD')} to ${endDate.format('YYYY-MM-DD')} (${
          costs?.resultsByTime.length
        } days)`}
        columnDefinitions={columnDefinitions(totalCost, priceFormat) as any}
        items={costs?.resultsByTime || []}
        defaultPageSize={30}
        disableRowSelect
        pageSizes={[30, 60, 90]}
        loading={isFetching}
      />
    </Stack>
  );
};

export default AccountCosts;
