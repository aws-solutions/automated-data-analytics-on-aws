/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { TestApp as App, TEST_ENVIRONMENT, cleanTemplateForSnapshot } from '@ada/cdk-core';
import { DEFAULT_CALLER, MOCK_BASE_DATAPRODUCT, TEST_STATIC_INFRASTRUCTURE } from '@ada/microservice-test-common';
import { DataProductUpdateTriggerType } from '@ada/common';
import { DynamicInfra } from '@ada/data-product-infra-types';
import { GoogleAnalyticsSourceTask } from './stack';
import { ID } from '../..';
import { ISourceDetails__GOOGLE_ANALYTICS } from '../..';
import { Template } from 'aws-cdk-lib/assertions';
import { testSynthesizeConnectorStack } from '@ada/services/data-product/dynamic-infrastructure/synthesizers/testing/helpers';

describe('google-analytics-source', () => {
  it('should create resources', () => {
    const app = new App();
    const props: DynamicInfra.StackProps = {
      env: TEST_ENVIRONMENT,
      dataProduct: {
        ...MOCK_BASE_DATAPRODUCT,
        sourceDetails: {
          clientId: 'client-id',
          clientEmail: 'email@domain.example.com',
          privateKeyId: 'private-key-id',
          privateKeySecretName: 'private-key-secret',
          projectId: 'project',
          viewId: '173381731',
          since: '2020-12-31',
          until: '2021-11-16',
          dimensions: 'ga:country,ga:users',
          metrics: 'ga:sessions',
        } as ISourceDetails__GOOGLE_ANALYTICS,
        updateTrigger: { triggerType: DataProductUpdateTriggerType.ON_DEMAND },
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

    expect(() => Template.fromStack(new GoogleAnalyticsSourceTask(app, 'test-stack', props))).not.toThrow();
  });
});

describe('stack/synthesizer/google-analytics', () => {
  it('snapshot', async () => {
    const stack = await testSynthesizeConnectorStack({
      sourceType: ID,
      sourceDetails: {
        dimensions: ['ga:dimension1', 'ga:dimension2'].join(','),
        metrics: ['ga:metric1', 'ga:metric2'].join(','),
        projectId: 'mock-project-id',
        viewId: 'mock-view-id',
        // common
        clientEmail: 'mock@example.com',
        clientId: 'mock-client-id',
        privateKeyId: 'mock-private-key-id',
        privateKey: 'mock-private-key',
        privateKeySecretName: 'mock-private-key-secret-name',
      } as ISourceDetails__GOOGLE_ANALYTICS,
    });

    expect(cleanTemplateForSnapshot(Template.fromStack(stack).toJSON())).toMatchSnapshot();
  });
});
