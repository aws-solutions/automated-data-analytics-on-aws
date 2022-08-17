/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { ComponentMeta, ComponentStory } from '@storybook/react';

import { CostRootView } from './index';
import { GetCostOutput } from '@ada/api';
import { act } from '@testing-library/react';
import { delay } from '$common/utils';
import { useImmediateEffect } from '$common/hooks';
import { userEvent, within } from '@storybook/testing-library';

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: 'Views/Cost/Root',
  component: CostRootView,
  args: {},
} as ComponentMeta<typeof CostRootView>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof CostRootView> = (args, context) => {
  useImmediateEffect(() => {
    switch (context.parameters.variant) {
      case 'errorState': {
        API.listCosts.mockRejectedValue(new Error('Failed to fetch const'));
        break;
      }
      case 'zeroState': {
        API.listCosts.mockResolvedValue({
          dimensionValueAttributes: [],
          groupDefinitions: [],
          resultsByTime: [],
        });
        break;
      }
      default: {
        API.listCosts.mockResolvedValue(MOCK_COSTS);
      }
    }
  });

  return <CostRootView {...args} />;
};

export const Primary = Template.bind({});
export const Coverage = Template.bind({});

Coverage.play = async ({ canvasElement }) => {
  const canvas = within(canvasElement);

  await act(async () => {
    await delay(10);
    userEvent.click(await canvas.findByText(/last 60 days/i));
  });
  await act(async () => {
    await delay(10);
    userEvent.click(await canvas.findByText(/last 90 days/i));
  });
  await act(async () => {
    await delay(10);
    userEvent.click(await canvas.findByText(/service costs/i));
  });
};

export const ErrorState = Template.bind({});
ErrorState.parameters = {
  variant: 'errorState',
};

export const ZeroState = Template.bind({});
ZeroState.parameters = {
  variant: 'zeroState',
};

const MOCK_COSTS: GetCostOutput = {
  groupDefinitions: [
    {
      type: 'DIMENSION',
      key: 'SERVICE',
    },
    {
      type: 'TAG',
      key: 'Application',
    },
  ],
  resultsByTime: [
    {
      timePeriod: {
        start: '2021-11-21',
        end: '2021-11-22',
      },
      total: {},
      groups: [
        {
          keys: ['AWS Key Management Service', 'Application$Ada'],
          metrics: {
            blendedCost: {
              amount: '0.677455344',
              unit: 'USD',
            },
            usageQuantity: {
              amount: '12.677419344',
              unit: 'N/A',
            },
          },
        },
        {
          keys: ['AWS Lambda', 'Application$Ada'],
          metrics: {
            blendedCost: {
              amount: '4.3701397866',
              unit: 'USD',
            },
            usageQuantity: {
              amount: '100.0',
              unit: 'N/A',
            },
          },
        },
        {
          keys: ['AWS Step Functions', 'Application$Ada'],
          metrics: {
            blendedCost: {
              amount: '0.005725',
              unit: 'USD',
            },
            UsageQuantity: {
              amount: '229',
              unit: 'N/A',
            },
          },
        },
      ],
      estimated: true,
    },
    {
      timePeriod: {
        start: '2021-11-22',
        end: '2021-11-23',
      },
      total: {},
      groups: [
        {
          keys: ['AWS Key Management Service', 'Application$Ada'],
          metrics: {
            blendedCost: {
              amount: '0.677455344',
              unit: 'USD',
            },
            usageQuantity: {
              amount: '12.677419344',
              unit: 'N/A',
            },
          },
        },
        {
          keys: ['AWS Lambda', 'Application$Ada'],
          metrics: {
            blendedCost: {
              amount: '4.3701397866',
              unit: 'USD',
            },
            usageQuantity: {
              amount: '1048292.364625',
              unit: 'N/A',
            },
          },
        },
        {
          keys: ['AWS Step Functions', 'Application$Ada'],
          metrics: {
            blendedCost: {
              amount: '0.005725',
              unit: 'USD',
            },
            usageQuantity: {
              amount: '229',
              unit: 'N/A',
            },
          },
        },
      ],
      estimated: true,
    },
  ],
  dimensionValueAttributes: [],
};
