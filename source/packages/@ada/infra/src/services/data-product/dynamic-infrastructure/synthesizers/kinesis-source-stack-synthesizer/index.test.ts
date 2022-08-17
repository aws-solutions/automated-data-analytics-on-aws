/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { SourceDetailsKinesis, SourceType } from '@ada/common';
import { KinesisSourceStackSynthesizer as Synthesizer } from '.';
import { TEST_ARN } from '@ada/infra-common/services/testing';
import { Template } from 'aws-cdk-lib/assertions';
import { cleanTemplateForSnapshot } from '@ada/cdk-core';
import { createMockStackSynthesizerProps } from '../testing/helpers';

describe('stack/synthesizer/s3', () => {
  it('snapshot', async () => {
    const synthProps = createMockStackSynthesizerProps({
      sourceType: SourceType.S3,
      sourceDetails: {
        kinesisStreamArn: TEST_ARN,
      } as SourceDetailsKinesis,
    });

    const synthesizer = new Synthesizer();
    const stack = await synthesizer.synthesize(synthProps);

    expect(cleanTemplateForSnapshot(Template.fromStack(stack).toJSON())).toMatchSnapshot();
  });
});
