/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { TestApp as App, TEST_ENVIRONMENT } from '@ada/cdk-core';
import {
  DEFAULT_CALLER,
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  MOCK_BASE_DATAPRODUCT,
  TEST_STATIC_INFRASTRUCTURE,
} from '@ada/microservice-test-common';
import { DataProductUpdateTriggerType } from '@ada/common';
import { QuerySourceStack, QuerySourceStackProps } from '../query-source-stack';
import { Template } from 'aws-cdk-lib/assertions';

describe('query-source-stack', () => {
  it('should create resources', () => {
    const app = new App();
    const props: QuerySourceStackProps = {
      env: TEST_ENVIRONMENT,
      dataProduct: {
        ...MOCK_BASE_DATAPRODUCT,
        sourceDetails: { query: 'select * from data.product' },
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
      generatedQuery: 'select * from (select col1, col2 from governed.data.product)',
      parentDataProducts: [DEFAULT_S3_SOURCE_DATA_PRODUCT],
    };

    expect(() => Template.fromStack(new QuerySourceStack(app, 'test-stack', props))).not.toThrow();
  });
});
