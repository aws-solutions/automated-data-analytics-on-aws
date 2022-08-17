/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API, apiClientErrorResponse } from '@ada/api-client/mock';
import { CachedQueryStore } from '../../../components/ddb/cached-query';
import { CallingUser, OntologyNamespace, ReservedDataProducts, ReservedDomains } from '@ada/common';
import {
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import {
  DataProduct,
  DataProductPermissions,
  PostQueryParseRenderDiscoverResponse,
  SavedQuery,
  SavedQueryIdentifier,
} from '@ada/api-client';
import { PrivateSavedQueryStore, PublicSavedQueryStore } from '../../../components/ddb/saved-query';
import { buildApiRequest } from '@ada/api-gateway';
import { handler } from '../put-saved-query';

jest.mock('@ada/api-client');

const DEFAULT_USER = 'test-user';

const PRIVATE_QUERY_ID = {
  namespace: DEFAULT_USER,
  queryId: 'test',
};
const SAVED_PRIVATE_QUERY: SavedQuery = {
  ...PRIVATE_QUERY_ID,
  addressedAs: 'my.queries.test',
  type: 'PRIVATE',
  query: 'select * from foo',
  referencedDataSets: [],
  referencedQueries: [],
};

const PUBLIC_QUERY_ID: SavedQueryIdentifier = {
  namespace: 'domain',
  queryId: 'test',
};
const SAVED_PUBLIC_QUERY: SavedQuery = {
  ...PUBLIC_QUERY_ID,
  addressedAs: 'domain.queries.test',
  type: 'PUBLIC',
  query: 'select * from foo',
  referencedDataSets: [],
  referencedQueries: [],
};

const DATA_PRODUCT: DataProduct = {
  ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
  domainId: 'default',
  dataProductId: 'test',
  dataSets: {
    myDataSet: {
      identifiers: {
        catalog: 'AwsDataCatalog',
        database: 'default',
        table: 'test',
      },
      columnMetadata: {
        firstName: {
          description: 'The customer first name',
          dataType: 'string',
          ontologyAttributeId: 'name-attribute-id',
          ontologyNamespace: OntologyNamespace.DEFAULT,
        },
        lastName: {
          description: 'The customer last name',
          dataType: 'string',
          ontologyAttributeId: 'name-attribute-id',
          ontologyNamespace: OntologyNamespace.DEFAULT,
        },
        email: { description: 'The customer email', dataType: 'string' },
        age: { description: 'The customer age', dataType: 'bigint' },
      },
    },
  },
};

describe('put-saved-query', () => {
  const now = '2021-01-01T00:00:00.000Z';

  let testPublicSavedQueryStore: PublicSavedQueryStore;
  let testPrivateSavedQueryStore: PrivateSavedQueryStore;
  let testCachedQueryStore: CachedQueryStore;

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    testPublicSavedQueryStore = new (PublicSavedQueryStore as any)(getLocalDynamoDocumentClient());
    PublicSavedQueryStore.getInstance = jest.fn(() => testPublicSavedQueryStore);
    testPrivateSavedQueryStore = new (PrivateSavedQueryStore as any)(getLocalDynamoDocumentClient());
    PrivateSavedQueryStore.getInstance = jest.fn(() => testPrivateSavedQueryStore);
    testCachedQueryStore = new (CachedQueryStore as any)(getLocalDynamoDocumentClient());
    CachedQueryStore.getInstance = jest.fn(() => testCachedQueryStore);

    jest.clearAllMocks();
  })

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());

    // Always permitted to access data products for these tests
    API.getGovernancePolicyDomainDataProductPermissions.mockResolvedValue({
      admin: {
        access: 'FULL',
      },
    } as DataProductPermissions);
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  const putSavedQuery = (
    namespace: string,
    queryId: string,
    query: string = 'select * from foo',
    callingUser: CallingUser = { userId: DEFAULT_USER, username: `${DEFAULT_USER}@usr.example.com`, groups: ['admin'] },
  ) =>
    handler(
      buildApiRequest(callingUser, {
        pathParameters: { namespace, queryId },
        body: { query },
      }) as any,
      null,
    );

  it('should return 404 when the namespaced domain does not exist', async () => {
    API.getDataProductDomain.mockRejectedValue(apiClientErrorResponse(404, { message: 'Not Found' }));
    expect((await putSavedQuery('wrong_domain', 'test')).statusCode).toBe(404);
  });

  it('should return 400 when the public saved query already exists', async () => {
    API.getDataProductDomain.mockResolvedValue({
      domainId: PUBLIC_QUERY_ID.namespace,
      name: 'Test Domain',
    });
    await testPublicSavedQueryStore.putSavedQuery(PUBLIC_QUERY_ID, DEFAULT_USER, SAVED_PUBLIC_QUERY);
    expect((await putSavedQuery(PUBLIC_QUERY_ID.namespace, PUBLIC_QUERY_ID.queryId)).statusCode).toBe(400);
  });

  it('should return 400 when the private saved query already exists', async () => {
    await testPrivateSavedQueryStore.putSavedQuery(PRIVATE_QUERY_ID, DEFAULT_USER, SAVED_PRIVATE_QUERY);
    expect((await putSavedQuery(DEFAULT_USER, PRIVATE_QUERY_ID.queryId)).statusCode).toBe(400);
  });

  it('should write a simple saved private query that references a data product', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue({
      tables: [{ identifierParts: ['data', 'product'] }],
    } as PostQueryParseRenderDiscoverResponse);
    API.getDataProductDomainDataProduct.mockResolvedValue({
      ...DATA_PRODUCT,
      domainId: 'data',
      dataProductId: 'product',
    });

    const response = await putSavedQuery(DEFAULT_USER, PRIVATE_QUERY_ID.queryId, 'select * from data.product');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        addressedAs: 'my.queries.test',
        queryId: PRIVATE_QUERY_ID.queryId,
        type: 'PRIVATE',
        namespace: DEFAULT_USER,
        query: 'select * from data.product',
        referencedQueries: [],
        referencedDataSets: [
          { addressedAs: 'data.product', domainId: 'data', dataProductId: 'product', dataSetId: 'myDataSet' },
        ],
      } as SavedQuery),
    );

    // Should be saved in the private query store, not the public one
    expect((await testPublicSavedQueryStore.listAllSavedQueries({})).queries).toHaveLength(0);
    expect((await testPrivateSavedQueryStore.listAllSavedQueries({})).queries).toHaveLength(1);
  });

  it('should write a simple saved private query that references another query', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue({
      tables: [{ identifierParts: [ReservedDomains.MY, ReservedDataProducts.QUERIES, 'referenced'] }],
    } as PostQueryParseRenderDiscoverResponse);
    API.getQuerySavedQuery.mockResolvedValue({
      namespace: DEFAULT_USER,
      addressedAs: 'my.queries.referenced',
      type: 'PRIVATE',
      queryId: 'referenced',
      query: 'select * from data.product',
      referencedQueries: [],
      referencedDataSets: [
        { addressedAs: 'data.product', domainId: 'data', dataProductId: 'product', dataSetId: 'myDataSet' },
      ],
    } as SavedQuery);
    API.getDataProductDomainDataProduct.mockResolvedValue({
      ...DATA_PRODUCT,
      domainId: 'data',
      dataProductId: 'product',
    });

    const response = await putSavedQuery(DEFAULT_USER, PRIVATE_QUERY_ID.queryId, 'select * from my.queries.referenced');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        addressedAs: 'my.queries.test',
        type: 'PRIVATE',
        queryId: PRIVATE_QUERY_ID.queryId,
        namespace: DEFAULT_USER,
        query: 'select * from my.queries.referenced',
        referencedQueries: [{ queryId: 'referenced', namespace: DEFAULT_USER }],
        referencedDataSets: [
          { addressedAs: 'data.product', domainId: 'data', dataProductId: 'product', dataSetId: 'myDataSet' },
        ],
      } as SavedQuery),
    );

    // Should be saved in the private query store, not the public one
    expect((await testPublicSavedQueryStore.listAllSavedQueries({})).queries).toHaveLength(0);
    expect((await testPrivateSavedQueryStore.listAllSavedQueries({})).queries).toHaveLength(1);
  });

  it('should write a saved public query that references a data product', async () => {
    API.getDataProductDomain.mockResolvedValue({
      domainId: PUBLIC_QUERY_ID.namespace,
      name: 'Test Domain',
    });
    API.postQueryParseRenderDiscover.mockResolvedValue({
      tables: [{ identifierParts: ['data', 'product'] }],
    } as PostQueryParseRenderDiscoverResponse);
    API.getDataProductDomainDataProduct.mockResolvedValue({
      ...DATA_PRODUCT,
      domainId: 'data',
      dataProductId: 'product',
    });

    const response = await putSavedQuery(
      PUBLIC_QUERY_ID.namespace,
      PUBLIC_QUERY_ID.queryId,
      'select * from data.product',
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        addressedAs: 'domain.queries.test',
        type: 'PUBLIC',
        queryId: PUBLIC_QUERY_ID.queryId,
        namespace: PUBLIC_QUERY_ID.namespace,
        query: 'select * from data.product',
        referencedQueries: [],
        referencedDataSets: [
          { addressedAs: 'data.product', domainId: 'data', dataProductId: 'product', dataSetId: 'myDataSet' },
        ],
      } as SavedQuery),
    );

    // Should be saved in the public query store, not the private one
    expect((await testPublicSavedQueryStore.listAllSavedQueries({})).queries).toHaveLength(1);
    expect((await testPrivateSavedQueryStore.listAllSavedQueries({})).queries).toHaveLength(0);
  });

  it('should return 400 when attempting to save a public query that references a private query', async () => {
    API.getDataProductDomain.mockResolvedValue({
      domainId: PUBLIC_QUERY_ID.namespace,
      name: 'Test Domain',
    });
    API.postQueryParseRenderDiscover.mockResolvedValue({
      tables: [{ identifierParts: [ReservedDomains.MY, ReservedDataProducts.QUERIES, 'referenced'] }],
    } as PostQueryParseRenderDiscoverResponse);
    API.getQuerySavedQuery.mockResolvedValue({
      namespace: DEFAULT_USER,
      addressedAs: 'my.queries.referenced',
      queryId: 'referenced',
      type: 'PRIVATE',
      query: 'select * from data.product',
      referencedQueries: [],
      referencedDataSets: [
        { addressedAs: 'data.product', domainId: 'data', dataProductId: 'product', dataSetId: 'myDataSet' },
      ],
    } as SavedQuery);
    API.getDataProductDomainDataProduct.mockResolvedValue({
      ...DATA_PRODUCT,
      domainId: 'data',
      dataProductId: 'product',
    });

    const response = await putSavedQuery(
      PUBLIC_QUERY_ID.namespace,
      PUBLIC_QUERY_ID.queryId,
      'select * from my.queries.referenced',
    );

    expect(response.statusCode).toBe(400);
  });

  it('should write a saved private query that references a data product source dataset', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue({
      tables: [{ identifierParts: [ReservedDomains.SOURCE, 'data', 'product'] }],
    } as PostQueryParseRenderDiscoverResponse);
    API.getDataProductDomainDataProduct.mockResolvedValue({
      ...DATA_PRODUCT,
      domainId: 'data',
      dataProductId: 'product',
      createdBy: DEFAULT_USER,
      sourceDataSets: DATA_PRODUCT.dataSets,
    });

    const response = await putSavedQuery(DEFAULT_USER, PRIVATE_QUERY_ID.queryId, 'select * from source.data.product');

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        addressedAs: 'my.queries.test',
        queryId: PRIVATE_QUERY_ID.queryId,
        type: 'PRIVATE',
        namespace: DEFAULT_USER,
        query: 'select * from source.data.product',
        referencedQueries: [],
        referencedDataSets: [
          { addressedAs: 'source.data.product', domainId: 'data', dataProductId: 'product', dataSetId: 'myDataSet' },
        ],
      } as SavedQuery),
    );

    // Should be saved in the private query store, not the public one
    expect((await testPublicSavedQueryStore.listAllSavedQueries({})).queries).toHaveLength(0);
    expect((await testPrivateSavedQueryStore.listAllSavedQueries({})).queries).toHaveLength(1);
  });
});
