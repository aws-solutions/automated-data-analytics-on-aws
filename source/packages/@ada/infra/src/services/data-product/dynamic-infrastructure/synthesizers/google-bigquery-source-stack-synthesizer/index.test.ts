/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { SourceDetailsGoogleBigQuery, SourceType } from '@ada/common';
import { GoogleBigQuerySourceStackSynthesizer as Synthesizer } from '.';
import { Template } from 'aws-cdk-lib/assertions';
import { cleanTemplateForSnapshot } from '@ada/cdk-core';
import { createMockStackSynthesizerProps } from '../testing/helpers';

describe('stack/synthesizer/google-analytics', () => {
  it('snapshot', async () => {
    const synthProps = createMockStackSynthesizerProps({
      sourceType: SourceType.GOOGLE_BIGQUERY,
      sourceDetails: {
        projectId: 'mock-project-id',
        query: 'SELECT * FROM mock',
        // common
        clientEmail: 'mock@example.com',
        clientId: 'mock-client-id',
        privateKeyId: 'mock-private-key-id',
        privateKey: 'mock-private-key',
        privateKeySecretName: 'mock-private-key-secret-name',
      } as SourceDetailsGoogleBigQuery,
    });

    const synthesizer = new Synthesizer();
    const stack = await synthesizer.synthesize(synthProps);

    expect(cleanTemplateForSnapshot(Template.fromStack(stack).toJSON())).toMatchSnapshot();
  });
});
