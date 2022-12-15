/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { TestApp as App, TEST_ENVIRONMENT, cleanTemplateForSnapshot } from '@ada/cdk-core';
import { DEFAULT_CALLER, MOCK_BASE_DATAPRODUCT, TEST_STATIC_INFRASTRUCTURE } from '@ada/microservice-test-common';
import { DataProductUpdateTriggerType } from '@ada/common';
import { DynamicInfra } from '@ada/data-product-infra-types';
import { GoogleStorageSourceTask } from './stack';
import { ID } from '../..';
import { ISourceDetails__GOOGLE_STORAGE } from '../..';
import { Template } from 'aws-cdk-lib/assertions';
import { testSynthesizeConnectorStack } from '@ada/services/data-product/dynamic-infrastructure/synthesizers/testing/helpers';

describe('google-storage-source', () => {
  it('should create resources', () => {
    const app = new App();
    const props: DynamicInfra.StackProps = {
      env: TEST_ENVIRONMENT,
      dataProduct: {
        ...MOCK_BASE_DATAPRODUCT,
        sourceDetails: {
          bucket: 'storage-bucket',
          key: 'storage-key',
          clientId: 'client-id',
          clientEmail: 'email@domain.example.com',
          privateKeyId: 'private-key-id',
          privateKeySecretName: 'private-key-secret',
          projectId: 'project',
        } as ISourceDetails__GOOGLE_STORAGE,
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

    expect(() => Template.fromStack(new GoogleStorageSourceTask(app, 'test-stack', props))).not.toThrow();
  });
});


describe('stack/synthesizer/google-analytics', () => {
  it('snapshot', async () => {
    const stack = await testSynthesizeConnectorStack({
      sourceType: ID,
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
      } as ISourceDetails__GOOGLE_STORAGE,
    });

    expect(cleanTemplateForSnapshot(Template.fromStack(stack).toJSON())).toMatchSnapshot();
  });
});
