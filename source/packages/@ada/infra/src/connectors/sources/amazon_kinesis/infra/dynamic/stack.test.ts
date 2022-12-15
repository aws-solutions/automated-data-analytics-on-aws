/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { TestApp as App, TEST_ENVIRONMENT } from '@ada/cdk-core';
import { DEFAULT_CALLER, MOCK_BASE_DATAPRODUCT, TEST_STATIC_INFRASTRUCTURE } from '@ada/microservice-test-common';
import { DataProductUpdateTriggerType } from '@ada/common';
import { DynamicInfra } from '@ada/data-product-infra-types';
import { ID } from '../..';
import { ISourceDetails__KINESIS } from "../..";
import { KinesisSourceStack } from './stack';
import { TEST_ARN } from '@ada/infra-common/services/testing';
import { Template } from 'aws-cdk-lib/assertions';
import { cleanTemplateForSnapshot } from '@ada/cdk-core';
import { testSynthesizeConnectorStack } from '@ada/dynamic-infra/synthesizers/testing/helpers';

describe('kinesis-source-stack', () => {
  const props: DynamicInfra.StackProps = {
    env: TEST_ENVIRONMENT,
    dataProduct: {
      ...MOCK_BASE_DATAPRODUCT,
      sourceDetails: { kinesisStreamArn: 'arn:aws:kinesis:us-east-2:016893383669:stream/kinesis-test' },
      sourceType: ID,
      updateTrigger: { triggerType: DataProductUpdateTriggerType.ON_DEMAND },
      enableAutomaticTransforms: true,
      transforms: [],
    } as any,
    callingUser: {
      ...DEFAULT_CALLER,
      userId: 'this-user-id-should-be-in-the-role-tags',
    },
    staticInfrastructure: TEST_STATIC_INFRASTRUCTURE,
  };

  it('should create resources', () => {
    const app = new App();
    expect(() => Template.fromStack(new KinesisSourceStack(app, 'test-kinesis-stack', props))).not.toThrow();
  });

  it('should use external facing role for pulling kinesis source data', () => {
    const app = new App();
    const template = Template.fromStack(new KinesisSourceStack(app, 'test-kinesis-stack', props));
    const cfn = template.toJSON();
    const firehoseDeliveryStreamRefId = Object.keys(cfn.Resources).find(
      (refId) => cfn.Resources[refId].Type === 'AWS::KinesisFirehose::DeliveryStream',
    );

    expect(firehoseDeliveryStreamRefId).toBeDefined();

    const firehoseDeliveryStream = cfn.Resources[firehoseDeliveryStreamRefId!];
    const roleRefId = firehoseDeliveryStream.Properties.KinesisStreamSourceConfiguration.RoleARN['Fn::GetAtt'][0];
    const firehoseRole = cfn.Resources[roleRefId];

    const userIdTag = firehoseRole.Properties.Tags.find(({ Key }: any) => Key === 'ada:user');
    expect(userIdTag.Value).toBe('this-user-id-should-be-in-the-role-tags');
  });
});


describe('stack/synthesizer/s3', () => {
  it('snapshot', async () => {
    const stack = await testSynthesizeConnectorStack({
      sourceType: ID,
      sourceDetails: {
        kinesisStreamArn: TEST_ARN,
      } as ISourceDetails__KINESIS,
    });

    expect(cleanTemplateForSnapshot(Template.fromStack(stack).toJSON())).toMatchSnapshot();
  });
});
