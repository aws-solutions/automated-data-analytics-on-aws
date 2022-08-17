/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { TestApp as App, TEST_ENVIRONMENT } from '@ada/cdk-core';
import { DEFAULT_CALLER, MOCK_BASE_DATAPRODUCT, TEST_STATIC_INFRASTRUCTURE } from '@ada/microservice-test-common';
import { DataProductUpdateTriggerType, SourceDetailsGoogleStorage } from '@ada/common';
import { GoogleStorageSourceTask, GoogleStorageSourceTaskProps } from '../google-storage-source-stack';
import { Template } from 'aws-cdk-lib/assertions';

describe('google-storage-source', () => {
  it('should create resources', () => {
    const app = new App();
    const props: GoogleStorageSourceTaskProps = {
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
        } as SourceDetailsGoogleStorage,
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
