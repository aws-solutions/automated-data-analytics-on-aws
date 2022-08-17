/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Arn } from 'aws-cdk-lib';
import {
  CallingUser,
  DataProductDataStatus,
  DataProductInfrastructureStatus,
  DataProductUpdateTriggerType,
  DataSetIds,
  SourceType,
} from '@ada/common';
import { DataProduct } from '@ada/api';
import { StaticInfrastructure } from '../..';
import { TEST_ACCOUNT, TEST_REGION } from '@ada/cdk-core';

export const TEST_GLOBAL_HASH = 'ghash';

export const TEST_ARN = Arn.format(
  {
    service: 'lambda',
    resource: 'test',
    partition: 'aws',
    account: TEST_ACCOUNT,
    region: TEST_REGION,
  },
  undefined!,
);

export const DEFAULT_CALLER: CallingUser = {
  userId: 'test-user',
  groups: ['admin', 'analyst'],
  username: 'test-user@example.com',
};

export const DEFAULT_S3_SOURCE_DATA_PRODUCT_WITH_DATASETS: DataProduct = {
  dataProductId: 'test-data-product',
  domainId: 'test-domain',
  name: 'Test',
  sourceType: SourceType.S3,
  sourceDetails: {
    bucket: 'some-bucket',
    key: 'some-s3-key',
  },
  infrastructureStatus: DataProductInfrastructureStatus.PROVISIONING,
  dataStatus: DataProductDataStatus.NO_DATA,
  dataSets: {
    [DataSetIds.DEFAULT]: {
      identifiers: {
        table: DataSetIds.DEFAULT,
        catalog: 'catalog',
        database: 'db',
      },
      columnMetadata: {
        col1: {
          dataType: 'int',
        },
        col2: {
          dataType: 'string',
        },
      },
    },
    table2: {
      identifiers: {
        table: 'table2',
        catalog: 'catalog',
        database: 'db',
      },
      columnMetadata: {
        col1: {
          dataType: 'int',
        },
        col2: {
          dataType: 'string',
        },
      },
    },
  },
  tags: [],
  enableAutomaticTransforms: true,
  enableAutomaticPii: false,
  transforms: [],
  updateTrigger: {
    triggerType: DataProductUpdateTriggerType.ON_DEMAND,
  },
  parentDataProducts: [],
  childDataProducts: [],
};

export const MOCK_BASE_DATAPRODUCT: Omit<DataProduct, 'sourceType' | 'sourceDetails'> = {
  dataProductId: 'test-data-product',
  domainId: 'test-domain',
  name: 'Test',
  infrastructureStatus: DataProductInfrastructureStatus.PROVISIONING,
  dataStatus: DataProductDataStatus.NO_DATA,
  dataSets: {},
  tags: [],
  enableAutomaticTransforms: true,
  enableAutomaticPii: false,
  transforms: [],
  updateTrigger: {
    triggerType: DataProductUpdateTriggerType.ON_DEMAND,
  },
  parentDataProducts: [],
  childDataProducts: [],
};

export const DEFAULT_S3_SOURCE_DATA_PRODUCT: DataProduct = {
  ...MOCK_BASE_DATAPRODUCT,
  sourceType: SourceType.S3,
  sourceDetails: {
    bucket: 'some-bucket',
    key: 'some-s3-key',
  },
};

export const DEFAULT_GOOGLE_ANALYTICS_SOURCE_OD_DATA_PRODUCT: DataProduct = {
  dataProductId: 'test-data-product',
  domainId: 'test-domain',
  name: 'Test',
  sourceType: SourceType.GOOGLE_ANALYTICS,
  sourceDetails: {
    bucket: 'some-bucket',
    key: 'some-s3-key',
  },
  infrastructureStatus: DataProductInfrastructureStatus.PROVISIONING,
  dataStatus: DataProductDataStatus.NO_DATA,
  dataSets: {},
  tags: [],
  enableAutomaticTransforms: true,
  enableAutomaticPii: false,
  transforms: [],
  updateTrigger: {
    triggerType: DataProductUpdateTriggerType.ON_DEMAND,
  },
  parentDataProducts: [],
  childDataProducts: [],
};

export const DEFAULT_GOOGLE_ANALYTICS_SOURCE_SCHEULDED_DATA_PRODUCT: DataProduct = {
  dataProductId: 'test-data-product',
  domainId: 'test-domain',
  name: 'Test',
  sourceType: SourceType.GOOGLE_ANALYTICS,
  sourceDetails: {
    bucket: 'some-bucket',
    key: 'some-s3-key',
  },
  infrastructureStatus: DataProductInfrastructureStatus.PROVISIONING,
  dataStatus: DataProductDataStatus.NO_DATA,
  dataSets: {},
  tags: [],
  enableAutomaticTransforms: true,
  enableAutomaticPii: false,
  transforms: [],
  updateTrigger: {
    triggerType: DataProductUpdateTriggerType.SCHEDULE,
    scheduleRate: 'rate(1 month)',
    updatePolicy: 'APPEND',
  },
  parentDataProducts: [],
  childDataProducts: [],
};

export const TEST_STATIC_INFRASTRUCTURE: StaticInfrastructure = {
  globalHash: TEST_GLOBAL_HASH,
  counterTableName: 'counterTableName',
  glueSecurityConfigurationName: 'glueSecurityConfiguration',
  glueDatabaseArn: 'arn:aws:glue:us-east-1:123456789012:database/rawDB',
  glueKmsKeyArn: 'arn:aws:kms:us-east-1:123456789012:key/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  eventBusName: 'eventBus',
  glueCrawlerStateMachineName: 'glueCrawlerStateMachine',
  executeGeneratedQueryStateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:TestStateMachine',
  scriptBucketName: 'script-bucket',
  dataBucketName: 'data-bucket',
  executeAthenaQueryLambdaRoleArn: 'arn:aws:iam::123456789012:role/mock-role-name',
  lambdas: {
    discoverTransformsArn: TEST_ARN,
    getCrawledTableDetailsArn: TEST_ARN,
    prepareNextTransformArn: TEST_ARN,
    prepareCtasQueryArn: TEST_ARN,
    prepareExternalImportLambdaArn: TEST_ARN,
    validateS3PathLambdaArn: TEST_ARN,
    generatePIIQueryLambdaArn: TEST_ARN,
    athenaUtilitiesLambdaName: TEST_ARN,
    getPiiQueryResultLambdaArn: TEST_ARN,
    startDataImportLambdaArn: TEST_ARN,
  },
  googleCloudStorageConnector: {
    importDataStateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:TestStateMachineImport',
  },
  googleBigQueryConnector: {
    importDataStateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:TestStateMachineImport',
  },
  googleAnalyticsConnector: {
    importDataStateMachineArn: 'arn:aws:states:us-east-1:123456789012:stateMachine:TestStateMachineImport',
  },
};
