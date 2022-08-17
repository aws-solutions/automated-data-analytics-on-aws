/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { TestApp as App, TEST_ENVIRONMENT } from '@ada/cdk-core';
import { DEFAULT_CALLER, MOCK_BASE_DATAPRODUCT, TEST_STATIC_INFRASTRUCTURE } from '@ada/microservice-test-common';
import { DataProductUpdateTriggerType, SourceDetailsGoogleBigQuery } from '@ada/common';
import { GoogleBigQuerySourceTask, GoogleBigQuerySourceTaskProps } from '../google-bigquery-source-stack';
import { Template } from 'aws-cdk-lib/assertions';

describe('google-bigquery-source', () => {
  it('should create resources', () => {
    const app = new App();
    const props: GoogleBigQuerySourceTaskProps = {
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
          datasetName: 'dataset',
          query: 'SELECT * FROM XXX',
        } as SourceDetailsGoogleBigQuery,
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

    expect(() => Template.fromStack(new GoogleBigQuerySourceTask(app, 'test-stack', props))).not.toThrow();
  });
});
