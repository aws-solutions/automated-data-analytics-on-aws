/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { SourceDetailsGoogleAnalytics, SourceType } from '@ada/common';
import { GoogleAnalyticsSourceStackSynthesizer as Synthesizer } from '.';
import { Template } from 'aws-cdk-lib/assertions';
import { cleanTemplateForSnapshot } from '@ada/cdk-core';
import { createMockStackSynthesizerProps } from '../testing/helpers';

describe('stack/synthesizer/google-analytics', () => {
  it('snapshot', async () => {
    const synthProps = createMockStackSynthesizerProps({
      sourceType: SourceType.GOOGLE_ANALYTICS,
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
      } as SourceDetailsGoogleAnalytics,
    });

    const synthesizer = new Synthesizer();
    const stack = await synthesizer.synthesize(synthProps);

    expect(cleanTemplateForSnapshot(Template.fromStack(stack).toJSON())).toMatchSnapshot();
  });
});
