/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { SourceDetailsGoogleStorage, SourceType } from '@ada/common';
import { GoogleStorageSourceStackSynthesizer as Synthesizer } from '.';
import { Template } from 'aws-cdk-lib/assertions';
import { cleanTemplateForSnapshot } from '@ada/cdk-core';
import { createMockStackSynthesizerProps } from '../testing/helpers';

describe('stack/synthesizer/google-analytics', () => {
  it('snapshot', async () => {
    const synthProps = createMockStackSynthesizerProps({
      sourceType: SourceType.GOOGLE_STORAGE,
      sourceDetails: {
        bucket: 'mock-bucket',
        key: 'mock-bucket-key',
        projectId: 'mock-project-id',
        // common
        clientEmail: 'mock@example.com',
        clientId: 'mock-client-id',
        privateKeyId: 'mock-private-key-id',
        privateKey: 'mock-private-key',
        privateKeySecretName: 'mock-private-key-secret-name',
      } as SourceDetailsGoogleStorage,
    });

    const synthesizer = new Synthesizer();
    const stack = await synthesizer.synthesize(synthProps);

    expect(cleanTemplateForSnapshot(Template.fromStack(stack).toJSON())).toMatchSnapshot();
  });
});
