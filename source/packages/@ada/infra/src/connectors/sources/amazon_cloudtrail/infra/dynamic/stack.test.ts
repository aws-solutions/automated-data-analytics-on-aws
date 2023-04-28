/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { TestApp as App, TEST_ENVIRONMENT, cleanTemplateForSnapshot } from '@ada/cdk-core';
import { CloudTrailSourceStack } from './stack';
import { DEFAULT_CALLER, MOCK_BASE_DATAPRODUCT, TEST_STATIC_INFRASTRUCTURE } from '@ada/microservice-test-common';
import { DataProductUpdateTriggerType } from '@ada/common';
import { DynamicInfra } from '@ada/data-product-infra-types';
import { ID } from '../..';
import { ISourceDetails__CLOUDTRAIL } from '../..';
import { Template } from 'aws-cdk-lib/assertions';
import { testSynthesizeConnectorStack } from '@ada/services/data-product/dynamic-infrastructure/synthesizers/testing/helpers';

describe('cloudtrail-source-stack', () => {
  it.each([[DataProductUpdateTriggerType.ON_DEMAND]])(
    'should create resources with trigger type %s',
    async (trigger) => {
      const app = new App();
      const props: DynamicInfra.StackProps = {
        env: TEST_ENVIRONMENT,
        dataProduct: {
          ...MOCK_BASE_DATAPRODUCT,
          sourceDetails: {
            cloudTrailTrailArn: 'arn:aws:cloudtrail:ap-southeast-2:123456789012:trail/test-cloudtrail',
            cloudTrailEventTypes: 'Data',
            cloudTrailDateFrom: '2022-01-01T00:00:00.000Z',
          },
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

      expect(() => Template.fromStack(new CloudTrailSourceStack(app, 'test-cloudtrail-stack', props))).not.toThrow();
    },
  );

  it('should create resources schedule', () => {
    const app = new App();
    const props: DynamicInfra.StackProps = {
      dataProduct: {
        ...MOCK_BASE_DATAPRODUCT,
        sourceDetails: {
          cloudTrailTrailArn: 'arn:aws:cloudtrail:ap-southeast-2:123456789012:trail/test-cloudtrail',
          cloudTrailEventTypes: 'Data',
          cloudTrailDateFrom: '2022-01-01T00:00:00.000Z',
        },
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

    expect(() => Template.fromStack(new CloudTrailSourceStack(app, 'test-stack', props))).not.toThrow();
  });

  it('unsupported trigger type should throw an error', () => {
    const app = new App();
    const props: DynamicInfra.StackProps = {
      dataProduct: {
        ...MOCK_BASE_DATAPRODUCT,
        sourceDetails: {
          cloudTrailTrailArn: 'arn:aws:cloudtrail:ap-southeast-2:123456789012:trail/test-cloudtrail',
          cloudTrailEventTypes: 'Data',
          cloudTrailDateFrom: '2022-01-01T00:00:00.000Z',
        },
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

    expect(() => Template.fromStack(new CloudTrailSourceStack(app, 'test-stack', props))).toThrow();
  });
});

describe('stack/synthesizer/cloudtrail', () => {
  it('snapshot', async () => {
    const stack = await testSynthesizeConnectorStack({
      sourceType: ID,
      sourceDetails: {
        cloudTrailTrailArn: 'arn:aws:cloudtrail:ap-southeast-2:123456789012:trail/test-cloudtrail',
        cloudTrailEventTypes: 'Data',
        cloudTrailDateFrom: '2022-01-01T00:00:00.000Z',
        cloudTrailDateTo: '2022-01-03T00:00:00.000Z',
      } as ISourceDetails__CLOUDTRAIL,
    });

    expect(cleanTemplateForSnapshot(Template.fromStack(stack).toJSON())).toMatchSnapshot();
  });
});
