/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { TestApp as App, TEST_ENVIRONMENT } from '@ada/cdk-core';
import { DEFAULT_CALLER, MOCK_BASE_DATAPRODUCT, TEST_STATIC_INFRASTRUCTURE } from '@ada/microservice-test-common';
import { DataProductUpdateTriggerType, SourceDetailsGoogleAnalytics } from '@ada/common';
import { GoogleAnalyticsSourceTask, GoogleAnalyticsSourceTaskProps } from '../google-analytics-source-stack';
import { Template } from 'aws-cdk-lib/assertions';

describe('google-analytics-source', () => {
  it('should create resources', () => {
    const app = new App();
    const props: GoogleAnalyticsSourceTaskProps = {
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
        } as SourceDetailsGoogleAnalytics,
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
