/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { AthenaQueryExecutionState, CallingUser, DataProductSourceDataStatus } from '@ada/common';
import { ColumnsMetadata, CreateAndUpdateDetails, DataProduct, DataSetPreview } from '@ada/api-client';
import {
  DEFAULT_CALLER,
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  MOCK_BASE_DATAPRODUCT,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { DataProductStore } from '../../../components/ddb/data-product';
import { LambdaLog } from 'lambda-log';
import { handler } from '../build-data-product';
import { localDynamoLockClient } from '../../../../api/components/entity/locks/mock';
import { localDynamoRelationshipClient } from '../../../../api/components/entity/relationships/mock';
import { Connectors } from '@ada/connectors';

jest.mock('@ada/api-client-lambda');

const mockStartQueryExecution = jest.fn();
const mockGetQueryExecution = jest.fn();
const mockListObjectsV2 = jest.fn();
const mockDeleteObjects = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsSTSInstance: jest.fn().mockImplementation(() => ({
    assumeRole: () => ({
      promise: jest.fn(() =>
        Promise.resolve({
          Credentials: { AccessKeyId: 'accessKey', SecretAccessKey: 'secretKey', SessionToken: 'sessionToken' },
        }),
      ),
    }),
  })),
  AwsAthenaInstance: (_props: any) => ({
    startQueryExecution: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockStartQueryExecution(...args))),
    }),

    getQueryExecution: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockGetQueryExecution(...args))),
    }),
  }),
  AwsS3Instance: jest.fn().mockImplementation(() => ({
    listObjectsV2: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockListObjectsV2(...args))),
    }),
    deleteObjects: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDeleteObjects(...args))),
    }),
  })),
}));

const domainId = 'domain_id';
const dataProductId = 'data_product_id';
const dataProductIdentifier = { domainId, dataProductId };
const dataProduct = {
  ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
  ...dataProductIdentifier,
};
const dataSetPreview: DataSetPreview = {
  classification: 'csv',
  data: [],
  schema: {
    dataType: 'struct',
    fields: [
      {
        name: 'name',
        container: {
          dataType: 'string',
        },
      },
      {
        name: 'age',
        container: {
          dataType: 'long',
        },
      },
      {
        name: 'nested',
        container: {
          dataType: 'struct',
          fields: [
            {
              name: 'nested_array',
              container: {
                dataType: 'array',
                elementType: {
                  dataType: 'byte',
                },
              },
            },
          ],
        },
      },
    ],
  },
  s3Path: 's3://test/path',
};
const columnMetadata: ColumnsMetadata = {
  name: {
    dataType: 'string',
    sortOrder: 0,
  },
  age: {
    dataType: 'bigint',
    sortOrder: 1,
  },
  nested: {
    dataType: 'struct<nested_array: array<bigint>>',
    sortOrder: 2,
  },
};

const uploadDataProduct = {
  ...MOCK_BASE_DATAPRODUCT,
  sourceType: Connectors.Id.UPLOAD,
  sourceDetails: {
    bucket: 'some-bucket',
    key: 'some-s3-key',
  },
  ...dataProductIdentifier,
};

describe('build-data-product', () => {
  // Mock the dataProduct store to point to our local dynamodb
  const testDataProductStore = new (DataProductStore as any)(getLocalDynamoDocumentClient());
  let currentDataProduct: DataProduct & CreateAndUpdateDetails;
  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.resetAllMocks();
    localDynamoLockClient();
    localDynamoRelationshipClient();
    DataProductStore.getInstance = jest.fn(() => testDataProductStore);

    currentDataProduct = await testDataProductStore.putDataProduct(domainId, dataProductId, 'test-user', dataProduct);
    API.postDataProductPreviewDomainDataProduct.mockResolvedValue({ previewId: 'preview-id' });
    API.getDataProductPreviewDomainDataProduct.mockResolvedValue({
      status: 'SUCCEEDED',
      initialDataSets: {
        someDataSet: dataSetPreview,
      },
      transformedDataSets: {
        someDataSet: dataSetPreview,
      },
    });
    mockStartQueryExecution.mockResolvedValue({ QueryExecutionId: 'some-id' });
    mockGetQueryExecution.mockResolvedValue({
      QueryExecution: { Status: { State: AthenaQueryExecutionState.SUCCEEDED } },
    });
  });

  const buildDataProduct = (callingUser: CallingUser = DEFAULT_CALLER, inputDataProduct: DataProduct = dataProduct) =>
    handler(
      {
        callingUser,
        dataProduct: inputDataProduct,
      },
      null,
    );

  it('should update the data product with the appropriate message if the preview fails', async () => {
    API.getDataProductPreviewDomainDataProduct.mockResolvedValue({
      error: { message: 'It failed!' },
      status: 'FAILED',
    });

    await buildDataProduct();

    const updatedDataProduct = await testDataProductStore.getDataProduct(domainId, dataProductId);
    expect(updatedDataProduct.sourceDataStatus).toBe(DataProductSourceDataStatus.FAILED);
    expect(updatedDataProduct.sourceDataStatusDetails).toContain('FAILED');
    expect(updatedDataProduct.sourceDataStatusDetails).toContain('It failed!');
  });

  it('should update the schema with the preview schema if source type is not supported for source datasets', async () => {
    const notSupportedDataProduct: DataProduct & CreateAndUpdateDetails = {
      ...dataProduct,
      updatedTimestamp: currentDataProduct.updatedTimestamp,
      sourceType: Connectors.Id.GOOGLE_STORAGE,
    };
    await testDataProductStore.putDataProduct(domainId, dataProductId, 'test-user', notSupportedDataProduct);

    await buildDataProduct(DEFAULT_CALLER, notSupportedDataProduct);

    const updatedDataProduct = await testDataProductStore.getDataProduct(domainId, dataProductId);
    expect(updatedDataProduct.dataSets).toEqual({
      someDataSet: {
        identifiers: {},
        columnMetadata,
      },
    });

    expect(mockStartQueryExecution).not.toHaveBeenCalled();
  });

  it('should clean s3 upload folder', async () => {
    mockListObjectsV2.mockReturnValue({
      Contents: [
         {
        ETag: "\"70ee1738b6b21e2c8a43f3a5ab0eee71\"",
        Key: "happyface.jpg",
        LastModified: "<Date Representation>",
        Size: 11,
        StorageClass: "STANDARD"
       },
         {
        ETag: "\"becf17f89c30367a9a44495d62ed521a-1\"",
        Key: "test.jpg",
        LastModified: "<Date Representation>",
        Size: 4192256,
        StorageClass: "STANDARD"
       }
      ],
      IsTruncated: true,
      KeyCount: 2,
      MaxKeys: 2,
      Name: "some-bucket",
      NextContinuationToken: "1w41l63U0xa8q7smH50vCxyTQqdxo69O3EmK28Bi5PcROI4wI/EyIJg==",
      Prefix: ""
     });

     mockDeleteObjects.mockResolvedValue({
      Deleted: [
        {
       Key: "happyface.jpg",
       VersionId: "yoz3HB.ZhCS_tKVEmIOr7qYyyAaZSKVd"
      },
        {
       Key: "test.jpg",
       VersionId: "2LWg7lQLnY41.maGB5Z6SWW.dcq0vx7b"
      }
     ]
     })

    await buildDataProduct(DEFAULT_CALLER, uploadDataProduct);
    expect(mockListObjectsV2).toHaveBeenCalled();
    expect(mockDeleteObjects).toHaveBeenCalled();
  });

  it('should raise an excception if s3 returns errors', async () => {
    const alertSpy = jest.spyOn(LambdaLog.prototype, 'log');
    await buildDataProduct(DEFAULT_CALLER, uploadDataProduct);
    expect(alertSpy).toHaveBeenCalled();
  });

  it('should create the source dataset tables', async () => {
    await buildDataProduct();

    const updatedDataProduct = await testDataProductStore.getDataProduct(domainId, dataProductId);
    expect(updatedDataProduct.dataSets).toEqual({
      someDataSet: {
        identifiers: {},
        columnMetadata,
      },
    });
    expect(updatedDataProduct.sourceDataStatus).toBe(DataProductSourceDataStatus.READY);
    const sourceDataSet = updatedDataProduct.sourceDataSets.someDataSet;
    expect(sourceDataSet.columnMetadata).toEqual(columnMetadata);
    expect(sourceDataSet.identifiers.catalog).toBe('AwsDataCatalog');
    expect(sourceDataSet.identifiers.table).toContain('dp_source_domain_id_data_product_id_someDataSet');

    expect(mockStartQueryExecution).toHaveBeenCalled();
    const createTableQuery = mockStartQueryExecution.mock.calls[0][0].QueryString;
    expect(createTableQuery).toContain('dp_source_domain_id_data_product_id_someDataSet');
    expect(createTableQuery).toContain(`LOCATION 's3://test/path/`);
    expect(createTableQuery).toContain(`struct<nested_array: array<bigint>>`);
  });

  it('should create the source dataset tables when fields are empty', async () => {
    const dataSetPreviewWithEmtpyFields: DataSetPreview = {
      classification: 'csv',
      data: [],
      schema: {
        dataType: 'struct',
        fields: [
          {
            name: 'name',
            container: {
              dataType: 'string',
            },
          },
          {
            name: 'age',
            container: {
              dataType: 'long',
            },
          },
          {
            name: 'nested',
            container: {
              dataType: 'struct',
              fields: [],
            },
          },
        ],
      },
      s3Path: 's3://test/path',
    };
    API.getDataProductPreviewDomainDataProduct.mockResolvedValue({
      status: 'SUCCEEDED',
      initialDataSets: {
        someDataSet: dataSetPreviewWithEmtpyFields,
      },
      transformedDataSets: {
        someDataSet: dataSetPreviewWithEmtpyFields,
      },
    });
    await buildDataProduct();

    const updatedDataProduct = await testDataProductStore.getDataProduct(domainId, dataProductId);
    const expectedColumnMetadata = {
      name: {
        dataType: 'string',
        sortOrder: 0,
      },
      age: {
        dataType: 'bigint',
        sortOrder: 1,
      },
      nested: {
        dataType: 'string',
        sortOrder: 2,
      },
    };
    expect(updatedDataProduct.dataSets).toEqual({
      someDataSet: {
        identifiers: {},
        columnMetadata: expectedColumnMetadata,
      },
    });
    expect(updatedDataProduct.sourceDataStatus).toBe(DataProductSourceDataStatus.READY);
    const sourceDataSet = updatedDataProduct.sourceDataSets.someDataSet;
    expect(sourceDataSet.columnMetadata).toEqual(expectedColumnMetadata);
    expect(sourceDataSet.identifiers.catalog).toBe('AwsDataCatalog');
    expect(sourceDataSet.identifiers.table).toContain('dp_source_domain_id_data_product_id_someDataSet');

    expect(mockStartQueryExecution).toHaveBeenCalled();
    const createTableQuery = mockStartQueryExecution.mock.calls[0][0].QueryString;
    expect(createTableQuery).toContain('dp_source_domain_id_data_product_id_someDataSet');
    expect(createTableQuery).toContain(`LOCATION 's3://test/path/`);
  });

  it('should still save the preview schema if the source table creation fails', async () => {
    mockGetQueryExecution.mockResolvedValue({
      QueryExecution: { Status: { State: AthenaQueryExecutionState.FAILED, StateChangeReason: 'oh no!' } },
    });
    await buildDataProduct();

    const updatedDataProduct = await testDataProductStore.getDataProduct(domainId, dataProductId);
    expect(updatedDataProduct.dataSets).toEqual({
      someDataSet: {
        identifiers: {},
        columnMetadata,
      },
    });
    expect(updatedDataProduct.sourceDataStatus).toBe(DataProductSourceDataStatus.FAILED);
    expect(updatedDataProduct.sourceDataStatusDetails).toContain('oh no!');
  });
});
