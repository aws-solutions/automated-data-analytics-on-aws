/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { TestApp as App, TEST_ENVIRONMENT, cleanTemplateForSnapshot } from '@ada/cdk-core';
import { DEFAULT_CALLER, MOCK_BASE_DATAPRODUCT, TEST_STATIC_INFRASTRUCTURE } from '@ada/microservice-test-common';
import { DataProductUpdateTriggerType } from '@ada/common';
import { DynamicInfra } from '@ada/data-product-infra-types';
import { ID } from '../..';
import { ISourceDetails__REDSHIFT } from '../..';
import { RedshiftSourceStack } from './stack';
import { Template } from 'aws-cdk-lib/assertions';
import { testSynthesizeConnectorStack } from '@ada/services/data-product/dynamic-infrastructure/synthesizers/testing/helpers';

const baseSourceDetails = {
  databaseEndpoint: 'default.123456789012.us-east-1.redshift-serverless.amazonaws.com',
  databasePort: '5439',
  databaseName: 'dev',
  databaseTable: 'test_data',
  databaseType: 'Serverless',
  workgroup: 'default',
  databaseUsername: '',
  clusterIdentifier: '',
}

describe('redshift-source-stack', () => {
  it.each([[DataProductUpdateTriggerType.ON_DEMAND]])(
    'should create resources with trigger type %s',
    async (trigger) => {
      const app = new App();
      const props: DynamicInfra.StackProps = {
        env: TEST_ENVIRONMENT,
        dataProduct: {
          ...MOCK_BASE_DATAPRODUCT,
          sourceDetails: { 
            ...baseSourceDetails,
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

      expect(() => Template.fromStack(new RedshiftSourceStack(app, 'test-stack', props))).not.toThrow();
    },
  );

  it('should create resources schedule for cross account access', () => {
    const app = new App();
    const props: DynamicInfra.StackProps = {
      dataProduct: {
        ...MOCK_BASE_DATAPRODUCT,
        sourceDetails: {
          ...baseSourceDetails,
          crossAccountRoleArn: 'arn:aws:iam::11111111111:role/DynamoDB-FullAccess-For-Account',
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

    expect(() => Template.fromStack(new RedshiftSourceStack(app, 'test-stack', props))).not.toThrow();
  });

  it('unsupported trigger type should throw an error', () => {
    const app = new App();
    const props: DynamicInfra.StackProps = {
      dataProduct: {
        ...MOCK_BASE_DATAPRODUCT,
        sourceDetails: {
          ...baseSourceDetails,
          crossAccountRoleArn: 'arn:aws:iam::11111111111:role/DynamoDB-FullAccess-For-Account',
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

    expect(() => Template.fromStack(new RedshiftSourceStack(app, 'test-stack', props))).toThrow();
  });
});

describe('stack/synthesizer/redshift', () => {
  it('snapshot', async () => {
    const stack = await testSynthesizeConnectorStack({
      sourceType: ID,
      sourceDetails: {
        ...baseSourceDetails,
        crossAccountRoleArn: 'arn:aws:iam::11111111111:role/Redshift-Access-Role',
      } as ISourceDetails__REDSHIFT,
    });

    expect(cleanTemplateForSnapshot(Template.fromStack(stack).toJSON())).toMatchSnapshot();
  });
});
