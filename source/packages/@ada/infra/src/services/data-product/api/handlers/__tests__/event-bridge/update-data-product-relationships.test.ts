/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { MOCK_API_CLIENT as API, Api } from '@ada/api-client/mock';
import { CrawledTableDetail, DataProductEventDetailTypes, EventSource } from '@ada/microservice-common';
import {
  DEFAULT_CALLER,
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { DataProduct } from '@ada/api';
import { DataProductStore } from '../../../../components/ddb/data-product';
import { IRelationshipClient } from '../../../../../api/components/entity/relationships/client';
import { OntologyNamespace } from '@ada/common';
import { buildSource } from '../../../../../api/components/notification/common';
import { entityIdentifier } from '@ada/api/client/types';
import { handler } from '../../event-bridge/update-data-product';
import { localDynamoLockClient } from '../../../../../api/components/entity/locks/mock';
import { localDynamoRelationshipClient } from '../../../../../api/components/entity/relationships/mock';

jest.mock('@ada/api-client-lambda');

describe('update-data-product-relationships', () => {
  // Mock the dataProduct store to point to our local dynamodb
  const testDataProductStore = new (DataProductStore as any)(getLocalDynamoDocumentClient());
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
        piiClassification: 'age',
      },
      {
        name: 'col2',
        type: 'string',
        piiClassification: 'name',
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

  let relationshipClient: IRelationshipClient;

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.resetAllMocks();

    localDynamoLockClient();
    relationshipClient = localDynamoRelationshipClient();
    API.getOntology.mockResolvedValue({});
    DataProductStore.getInstance = jest.fn(() => testDataProductStore);
  });

  it('should add relationships to the related ontologies', async () => {
    const domainId = DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId;
    const dataProductId = 'my-data-product';

    // Put an existing data product in the store
    await testDataProductStore.putDataProduct(
      DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
      dataProductId,
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

    expect(
      await relationshipClient.getRelatedEntities(
        entityIdentifier('DataProductDomainDataProduct', { domainId, dataProductId }),
      ),
    ).toIncludeSameMembers([
      entityIdentifier('Ontology', { ontologyNamespace: OntologyNamespace.PII_CLASSIFICATIONS, ontologyId: 'name' }),
      entityIdentifier('Ontology', { ontologyNamespace: OntologyNamespace.PII_CLASSIFICATIONS, ontologyId: 'age' }),
    ]);
  });
});
