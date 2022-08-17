/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API, Api } from '@ada/api-client/mock';
import { CrawledTableDetail, DataProductEventDetailTypes, EventSource } from '@ada/microservice-common';
import {
  DEFAULT_CALLER,
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  DEFAULT_S3_SOURCE_DATA_PRODUCT_WITH_DATASETS,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { DataProduct } from '@ada/api';
import { DataProductDataStatus, DataSetIds } from '@ada/common';
import { DataProductStore } from '../../../../components/ddb/data-product';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { buildDataSetId, handler } from '../../event-bridge/update-data-product';
import { buildSource } from '../../../../../api/components/notification/common';
import { noopMockLockClient } from '../../../../../api/components/entity/locks/mock';
import { noopMockRelationshipClient } from '../../../../../api/components/entity/relationships/mock';

jest.mock('@ada/api-client-lambda');

describe('update-data-product', () => {
  // Mock the dataProduct store to point to our local dynamodb
  const testDataProductStore = new (DataProductStore as any)(getLocalDynamoDocumentClient());
  const now = '2021-01-01T00:00:00.000Z';
  const tableDetails: CrawledTableDetail = {
    tableName: 'tableName',
    tableNameSuffix: '',
    identifiers: {
      catalog: 'AwsDataCatalog',
      database: 'test-database',
      table: 'tableName',
    },
    columns: [
      {
        name: 'col1',
        type: 'int',
      },
      {
        name: 'col2',
        type: 'string',
      },
    ],
    averageRecordSize: 123,
    classification: 'json',
    compressed: true,
    location: 's3://location',
    recordCount: 100,
    compressionType: 'none',
  };
  const baseMockEventBridgeEvent = {
    region: '123',
    account: '123',
    version: '0',
    id: 'abc',
    time: '2021',
  };
  const consoleError = jest.spyOn(console, 'error');

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
    jest.resetAllMocks();

    noopMockLockClient();
    noopMockRelationshipClient();
    API.getOntology.mockResolvedValue({});
    DataProductStore.getInstance = jest.fn(() => testDataProductStore);
  });

  afterEach(async () => {
    jest.useRealTimers();
  });

  it('should update an existing data product if detail-type is success', async () => {
    // Put an existing data product in the store
    await testDataProductStore.putDataProduct(
      DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
      'my-data-product',
      'creator',
      DEFAULT_S3_SOURCE_DATA_PRODUCT,
    );

    // Update the data product
    await handler(
      {
        ...baseMockEventBridgeEvent,
        source: buildSource(EventSource.DATA_PRODUCTS),
        'detail-type': DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_SUCCESS,
        detail: {
          callingUser: DEFAULT_CALLER,
          dataProduct: {
            domainId: DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
            dataProductId: 'my-data-product',
          } as DataProduct,
          tableDetails: [tableDetails],
        },
      },
      null,
    );

    // Check the dataProduct is written to dynamodb
    expect(
      await testDataProductStore.getDataProduct(DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId, 'my-data-product'),
    ).toEqual({
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      dataProductId: 'my-data-product',
      createdBy: 'creator',
      updatedBy: 'system',
      createdTimestamp: now,
      updatedTimestamp: now,
      dataSets: {
        [DataSetIds.DEFAULT]: {
          identifiers: {
            table: tableDetails.identifiers.table,
            catalog: tableDetails.identifiers.catalog,
            database: tableDetails.identifiers.database,
          },
          columnMetadata: {
            col1: {
              dataType: 'int',
              sortOrder: 0,
            },
            col2: {
              dataType: 'string',
              sortOrder: 1,
            },
          },
        },
      },
      latestDataUpdateTimestamp: now,
      dataStatus: DataProductDataStatus.READY,
    });
  });

  it('should update an existing data product  with datasets if detail-type is success', async () => {
    // Put an existing data product in the store
    await testDataProductStore.putDataProduct(
      DEFAULT_S3_SOURCE_DATA_PRODUCT_WITH_DATASETS.domainId,
      'my-data-product',
      'creator',
      DEFAULT_S3_SOURCE_DATA_PRODUCT_WITH_DATASETS,
    );

    // Update the data product
    await handler(
      {
        ...baseMockEventBridgeEvent,
        source: buildSource(EventSource.DATA_PRODUCTS),
        'detail-type': DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_SUCCESS,
        detail: {
          callingUser: DEFAULT_CALLER,
          dataProduct: {
            domainId: DEFAULT_S3_SOURCE_DATA_PRODUCT_WITH_DATASETS.domainId,
            dataProductId: 'my-data-product',
            dataSets: DEFAULT_S3_SOURCE_DATA_PRODUCT_WITH_DATASETS.dataSets,
          } as DataProduct,
          tableDetails: [tableDetails],
        },
      },
      null,
    );

    // Check the dataProduct is written to dynamodb
    expect(
      await testDataProductStore.getDataProduct(DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId, 'my-data-product'),
    ).toEqual({
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      dataProductId: 'my-data-product',
      createdBy: 'creator',
      updatedBy: 'system',
      createdTimestamp: now,
      updatedTimestamp: now,
      dataSets: {
        [DataSetIds.DEFAULT]: {
          identifiers: {
            table: tableDetails.identifiers.table,
            catalog: tableDetails.identifiers.catalog,
            database: tableDetails.identifiers.database,
          },
          columnMetadata: {
            col1: {
              dataType: 'int',
              sortOrder: 0,
            },
            col2: {
              dataType: 'string',
              sortOrder: 1,
            },
          },
        },
      },
      latestDataUpdateTimestamp: now,
      dataStatus: DataProductDataStatus.READY,
    });
  });

  it('should update an existing data product with multiple discovered tables', async () => {
    // Put an existing data product in the store
    await testDataProductStore.putDataProduct(
      DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
      'my-data-product',
      'creator',
      DEFAULT_S3_SOURCE_DATA_PRODUCT,
    );

    // Update the data product
    await handler(
      {
        ...baseMockEventBridgeEvent,
        source: buildSource(EventSource.DATA_PRODUCTS),
        'detail-type': DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_SUCCESS,
        detail: {
          callingUser: DEFAULT_CALLER,
          dataProduct: {
            domainId: DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
            dataProductId: 'my-data-product',
          } as DataProduct,
          tableDetails: [
            {
              ...tableDetails,
              tableNameSuffix: 'table1',
              identifiers: {
                ...tableDetails.identifiers,
                database: 'my',
                table: 'table1',
              },
            },
            {
              ...tableDetails,
              tableNameSuffix: 'table2',
              identifiers: {
                ...tableDetails.identifiers,
                database: 'my',
                table: 'table2',
              },
            },
          ],
        },
      },
      null,
    );

    // Check the dataProduct is written to dynamodb
    expect(
      await testDataProductStore.getDataProduct(DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId, 'my-data-product'),
    ).toEqual({
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      dataProductId: 'my-data-product',
      createdBy: 'creator',
      updatedBy: 'system',
      createdTimestamp: now,
      updatedTimestamp: now,
      dataSets: {
        table1: {
          identifiers: {
            table: 'table1',
            database: 'my',
            catalog: tableDetails.identifiers.catalog,
          },
          columnMetadata: {
            col1: {
              dataType: 'int',
              sortOrder: 0,
            },
            col2: {
              dataType: 'string',
              sortOrder: 1,
            },
          },
        },
        table2: {
          identifiers: {
            table: 'table2',
            database: 'my',
            catalog: tableDetails.identifiers.catalog,
          },
          columnMetadata: {
            col1: {
              dataType: 'int',
              sortOrder: 0,
            },
            col2: {
              dataType: 'string',
              sortOrder: 1,
            },
          },
        },
      },
      latestDataUpdateTimestamp: now,
      dataStatus: DataProductDataStatus.READY,
    });
  });

  it('should not erase user-specified dataset details', async () => {
    // Put an existing data product in the store
    await testDataProductStore.putDataProduct(DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId, 'my-data-product', 'creator', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      dataSets: {
        table1: {
          name: 'First Table',
          description: 'The first table',
          identifiers: {
            catalog: 'some',
            database: 'old',
            table: 'table1',
          },
          columnMetadata: {},
        },
        table2: {
          name: 'Second Table',
          description: 'The second table',
          columnMetadata: {},
          identifiers: {
            catalog: 'some',
            database: 'old',
            table: 'table2',
          },
        },
        oldTable3: {
          name: 'Third Table',
          description: 'The third table',
          columnMetadata: {},
          identifiers: {
            catalog: 'some',
            database: 'old',
            table: 'table3',
          },
        },
      },
    });

    // Update the data product
    await handler(
      {
        ...baseMockEventBridgeEvent,
        source: buildSource(EventSource.DATA_PRODUCTS),
        'detail-type': DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_SUCCESS,
        detail: {
          callingUser: DEFAULT_CALLER,
          dataProduct: {
            domainId: DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
            dataProductId: 'my-data-product',
          } as DataProduct,
          // Only update for table1 and table2, so oldTable3 should not be present
          tableDetails: [
            {
              ...tableDetails,
              tableNameSuffix: 'table1',
              identifiers: {
                catalog: 'aws',
                database: 'my',
                table: 'table1',
              },
            },
            {
              ...tableDetails,
              tableNameSuffix: 'table2',
              identifiers: {
                catalog: 'aws',
                database: 'my',
                table: 'table2',
              },
            },
          ],
        },
      },
      null,
    );

    // Check the dataProduct is written to dynamodb
    expect(
      await testDataProductStore.getDataProduct(DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId, 'my-data-product'),
    ).toEqual({
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      dataProductId: 'my-data-product',
      createdBy: 'creator',
      updatedBy: 'system',
      createdTimestamp: now,
      updatedTimestamp: now,
      dataSets: {
        table1: {
          name: 'First Table',
          description: 'The first table',
          identifiers: {
            catalog: 'aws',
            database: 'my',
            table: 'table1',
          },
          columnMetadata: {
            col1: {
              dataType: 'int',
              sortOrder: 0,
            },
            col2: {
              dataType: 'string',
              sortOrder: 1,
            },
          },
        },
        table2: {
          name: 'Second Table',
          description: 'The second table',
          identifiers: {
            catalog: 'aws',
            database: 'my',
            table: 'table2',
          },
          columnMetadata: {
            col1: {
              dataType: 'int',
              sortOrder: 0,
            },
            col2: {
              dataType: 'string',
              sortOrder: 1,
            },
          },
        },
      },
      latestDataUpdateTimestamp: now,
      dataStatus: DataProductDataStatus.READY,
    });
  });

  it('should update the parent and child data product relationships', async () => {
    const childDomainId = 'child';
    const childDataProductId = 'child-1';
    const parentDomainId = 'parent';
    const parentDataProductId1 = 'parent-1';
    const parentDataProductId2 = 'parent-2';

    // Put an existing data product in the store
    await testDataProductStore.putDataProduct(childDomainId, childDataProductId, 'creator', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
    });

    // Put the parent data products in the store too
    await testDataProductStore.putDataProduct(parentDomainId, parentDataProductId1, 'creator', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
    });
    await testDataProductStore.putDataProduct(parentDomainId, parentDataProductId2, 'creator', {
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
    });

    // Update the data product
    await handler(
      {
        ...baseMockEventBridgeEvent,
        source: buildSource(EventSource.DATA_PRODUCTS),
        'detail-type': DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_SUCCESS,
        detail: {
          callingUser: DEFAULT_CALLER,
          dataProduct: {
            domainId: childDomainId,
            dataProductId: childDataProductId,
          } as DataProduct,
          tableDetails: [
            {
              ...tableDetails,
              tableNameSuffix: 'table1',
              identifiers: {
                catalog: 'aws',
                database: 'my',
                table: 'table1',
              },
            },
          ],
          parentDataProducts: [
            { domainId: parentDomainId, dataProductId: parentDataProductId1 },
            { domainId: parentDomainId, dataProductId: parentDataProductId2 },
          ],
        },
      },
      null,
    );

    const child = await testDataProductStore.getDataProduct(childDomainId, childDataProductId);
    const parent1 = await testDataProductStore.getDataProduct(parentDomainId, parentDataProductId1);
    const parent2 = await testDataProductStore.getDataProduct(parentDomainId, parentDataProductId2);

    expect(child!.childDataProducts).toEqual([]);
    expect(child!.parentDataProducts).toEqual([
      { domainId: parentDomainId, dataProductId: parentDataProductId1 },
      { domainId: parentDomainId, dataProductId: parentDataProductId2 },
    ]);

    expect(parent1!.parentDataProducts).toEqual([]);
    expect(parent2!.parentDataProducts).toEqual([]);

    expect(parent1!.childDataProducts).toEqual([{ domainId: childDomainId, dataProductId: childDataProductId }]);
    expect(parent2!.childDataProducts).toEqual([{ domainId: childDomainId, dataProductId: childDataProductId }]);
  });

  it('should update an existing data product if detail-type is error', async () => {
    // Put an existing data product in the store
    await testDataProductStore.putDataProduct(
      DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
      'my-error-dataproduct',
      'creator',
      DEFAULT_S3_SOURCE_DATA_PRODUCT,
    );

    // Update the data product
    await handler(
      {
        ...baseMockEventBridgeEvent,
        source: buildSource(EventSource.DATA_PRODUCTS),
        'detail-type': DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_ERROR,
        detail: {
          callingUser: DEFAULT_CALLER,
          dataProduct: {
            domainId: DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
            dataProductId: 'my-error-dataproduct',
          } as DataProduct,
          errorDetails: {
            Error: 'an error message',
            Cause: '',
          },
        },
      },
      null,
    );

    // Check the dataProduct is written to dynamodb
    expect(
      await testDataProductStore.getDataProduct(DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId, 'my-error-dataproduct'),
    ).toEqual({
      ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
      dataProductId: 'my-error-dataproduct',
      createdBy: 'creator',
      updatedBy: 'system',
      createdTimestamp: now,
      updatedTimestamp: now,
      dataStatus: DataProductDataStatus.FAILED,
      dataStatusDetails: 'an error message',
    });
  });

  it('should log an error if the data product does not exists', async () => {
    await handler(
      {
        ...baseMockEventBridgeEvent,
        source: buildSource(EventSource.DATA_PRODUCTS),
        'detail-type': DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_SUCCESS,
        detail: {
          callingUser: DEFAULT_CALLER,
          dataProduct: {
            domainId: DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
            dataProductId: 'my-missing-dataset',
          } as DataProduct,
          tableDetails: [tableDetails],
        },
      },
      null,
    );

    expect(consoleError).toBeCalledWith('Unexpected error, data product with id my-missing-dataset does not exist');
  });

  it('should log an error if the source is not supported', async () => {
    await handler(
      {
        ...baseMockEventBridgeEvent,
        source: 'com.another.app',
        'detail-type': DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_SUCCESS,
        detail: {
          callingUser: DEFAULT_CALLER,
          dataProduct: {
            domainId: DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
            dataProductId: 'my-missing-dataset',
          } as DataProduct,
          tableDetails: [tableDetails],
        },
      },
      null,
    );

    expect(consoleError).toBeCalledWith('Unsupported source com.another.app, skipping the event');
  });

  it('should log an error if the detail-type is not supported', async () => {
    await handler(
      {
        ...baseMockEventBridgeEvent,
        source: buildSource(EventSource.DATA_PRODUCTS),
        // this is not supported by the lambda
        'detail-type': DataProductEventDetailTypes.DATA_PRODUCT_ON_DEMAND_UPDATE,
        detail: {
          callingUser: DEFAULT_CALLER,
          dataProduct: {
            domainId: DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
            dataProductId: 'my-missing-dataset',
          } as DataProduct,
          tableDetails: [tableDetails],
        },
      },
      null,
    );

    expect(consoleError).toBeCalledWith('Unsupported detail type DataProductOnDemandUpdate, skipping the event');
  });

  it('should build a dataset id', () => {
    expect(buildDataSetId('my-data-product', '')).toBe(DataSetIds.DEFAULT);
    expect(buildDataSetId('my-data-product', 'my-data-product')).toBe(DataSetIds.DEFAULT);
    expect(buildDataSetId('my-data-product', `my-data-product_${DataSetIds.DEFAULT}`)).toBe(DataSetIds.DEFAULT);
    expect(buildDataSetId('my-data-product', 'specific_name')).toBe('specific_name');
    expect(buildDataSetId('my-data-product', 'my-data-product_specific_name')).toBe('specific_name');
    expect(buildDataSetId('my-data-product', 'my-data-product-specific_name')).toBe('specific_name');
    expect(buildDataSetId('my-data-product', 'my-data-productspecific_name')).toBe('specific_name');
  });
});
