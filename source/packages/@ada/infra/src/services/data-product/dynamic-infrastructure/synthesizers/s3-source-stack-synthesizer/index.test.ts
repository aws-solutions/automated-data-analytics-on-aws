/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { SourceDetailsS3, SourceType } from '@ada/common';
import { S3SourceStackSynthesizer as Synthesizer } from '.';
import { Template } from 'aws-cdk-lib/assertions';
import { cleanTemplateForSnapshot } from '@ada/cdk-core';
import { createMockStackSynthesizerProps } from '../testing/helpers';

describe('stack/synthesizer/s3', () => {
  it('snapshot', async () => {
    const synthProps = createMockStackSynthesizerProps({
      sourceType: SourceType.S3,
      sourceDetails: {
        bucket: 'test-bucket',
        key: 'test-key',
      } as SourceDetailsS3,
    });

    const synthesizer = new Synthesizer();
    const stack = await synthesizer.synthesize(synthProps);

    expect(cleanTemplateForSnapshot(Template.fromStack(stack).toJSON())).toMatchSnapshot();
  });
});
