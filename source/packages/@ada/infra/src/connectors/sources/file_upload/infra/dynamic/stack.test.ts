/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { TestApp as App, TEST_ENVIRONMENT } from '@ada/cdk-core';
import { DEFAULT_CALLER, MOCK_BASE_DATAPRODUCT, TEST_STATIC_INFRASTRUCTURE } from '@ada/microservice-test-common';
import { DataProductUpdateTriggerType } from '@ada/common';
import { DynamicInfra } from '@ada/data-product-infra-types';
import { FileUploadSourceTask } from './stack';
import { Template } from 'aws-cdk-lib/assertions';

describe('file-upload-source-stack', () => {
  it('should create resources', () => {
    const app = new App();
    const props: DynamicInfra.StackProps = {
      env: TEST_ENVIRONMENT,
      dataProduct: {
        ...MOCK_BASE_DATAPRODUCT,
        sourceDetails: { bucket: 'a.bucket', key: 'a.key' },
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

    expect(() =>
      Template.fromStack(new FileUploadSourceTask(app, 'test-file-upload-stack', props)),
    ).not.toThrow();
  });
});
