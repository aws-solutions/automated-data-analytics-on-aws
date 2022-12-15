/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { TestApp as App, TEST_ENVIRONMENT, cleanTemplateForSnapshot } from '@ada/cdk-core';
import { CloudWatchSourceStack } from './stack';
import { DEFAULT_CALLER, MOCK_BASE_DATAPRODUCT, TEST_STATIC_INFRASTRUCTURE } from '@ada/microservice-test-common';
import { DataProductUpdateTriggerType } from '@ada/common';
import { DynamicInfra } from '@ada/data-product-infra-types';
import { ID } from '../..';
import { ISourceDetails__CLOUDWATCH } from '../..';
import { Template } from 'aws-cdk-lib/assertions';
import { testSynthesizeConnectorStack } from '@ada/services/data-product/dynamic-infrastructure/synthesizers/testing/helpers';

describe('cloudwatch-source-stack', () => {
  it.each([[DataProductUpdateTriggerType.ON_DEMAND]])(
    'should create resources with trigger type %s',
    async (trigger) => {
      const app = new App();
      const props: DynamicInfra.StackProps = {
        env: TEST_ENVIRONMENT,
        dataProduct: {
          ...MOCK_BASE_DATAPRODUCT,
          sourceDetails: { cloudwatchLogGroupArn: 'arn:aws:logs:ap-southeast-1:123456789012:log-group:/myloggroup' },
          updateTrigger: { triggerType: trigger },
          enableAutomaticTransforms: true,
          transforms: [
            {
              scriptId: 'my-transform',
            },
          ],
        } as any,
        callingUser: DEFAULT_CALLER,
        staticInfrastructure: TEST_STATIC_INFRASTRUCTURE,
      };

      expect(() => Template.fromStack(new CloudWatchSourceStack(app, 'test-stack', props))).not.toThrow();
    },
  );

  it('should create resources schedule', () => {
    const app = new App();
    const props: DynamicInfra.StackProps = {
      dataProduct: {
        ...MOCK_BASE_DATAPRODUCT,
        sourceDetails: { cloudwatchLogGroupArn: 'arn:aws:logs:ap-southeast-1:123456789012:log-group:/myloggroup' },
        updateTrigger: { triggerType: DataProductUpdateTriggerType.SCHEDULE, scheduleRate: 'cron(0 12 * * ? *)' },
        enableAutomaticTransforms: true,
        transforms: [
          {
            scriptId: 'my-transform',
          },
        ],
      } as any,
      callingUser: DEFAULT_CALLER,
      staticInfrastructure: TEST_STATIC_INFRASTRUCTURE,
      env: TEST_ENVIRONMENT,
    };

    expect(() => Template.fromStack(new CloudWatchSourceStack(app, 'test-stack', props))).not.toThrow();
  });

  it('unsupported trigger type should throw an error', () => {
    const app = new App();
    const props: DynamicInfra.StackProps = {
      dataProduct: {
        ...MOCK_BASE_DATAPRODUCT,
        sourceDetails: { cloudwatchLogGroupArn: 'arn:aws:logs:ap-southeast-1:123456789012:log-group:/myloggroup' },
        updateTrigger: { triggerType: 'unknownTrigger' },
        transforms: [
          {
            scriptId: 'my-transform',
          },
        ],
      } as any,
      callingUser: DEFAULT_CALLER,
      staticInfrastructure: TEST_STATIC_INFRASTRUCTURE,
      env: TEST_ENVIRONMENT,
    };

    expect(() => Template.fromStack(new CloudWatchSourceStack(app, 'test-stack', props))).toThrow();
  });
});

describe('stack/synthesizer/cloudwatch', () => {
  it('snapshot', async () => {
    const stack = await testSynthesizeConnectorStack({
      sourceType: ID,
      sourceDetails: {
        cloudwatchLogGroupArn: 'arn:aws:logs:ap-southeast-1:123456789012:log-group:/myloggroup',
      } as ISourceDetails__CLOUDWATCH,
    });

    expect(cleanTemplateForSnapshot(Template.fromStack(stack).toJSON())).toMatchSnapshot();
  });
});
