/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as generateQuery from '../generate-query';
import { MOCK_API_CLIENT as API, ApiOperationRequest } from '@ada/api-client/mock';
import {
  ApiError,
  DataProduct,
  GetGovernancePolicyAttributeValuesResponse,
  GetGovernancePolicyAttributesResponse,
  OntologyEntity,
  PostQueryParseRenderDiscoverResponse,
  SavedQuery,
  SavedQueryIdentifier,
} from '@ada/api';
import { CachedQueryStore } from '../../../components/ddb/cached-query';
import {
  CallingUser,
  DataProductAccess,
  DataSetIds,
  LensIds,
  OntologyNamespace,
  ReservedDataProducts,
  ReservedDomains,
  UdfHash,
} from '@ada/common';
import {
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  apiGatewayEvent,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { DataProductPermissions } from '@ada/microservice-common';
import { apiClientErrorResponse } from '@ada/api/client/mock';
import { buildApiRequest } from '@ada/api-gateway';
import { toQueryAddressedAs } from '../../../components/saved-query';

jest.mock('@ada/api-client');

const DEFAULT_CALLER: CallingUser = {
  userId: 'test-user',
  username: 'test-user@usr.example.com',
  groups: ['admin', 'analyst'],
};

const queryDiscoverResponse: PostQueryParseRenderDiscoverResponse = {
  tables: [{ identifierParts: ['default', 'test'] }],
};

const queryDiscoverResponseWithQueries: PostQueryParseRenderDiscoverResponse = {
  tables: [
    { identifierParts: ['default', 'test'] },
    { identifierParts: ['my', ReservedDataProducts.QUERIES, 'test_1'] },
  ],
};

const badRequestResponse: ApiError = { message: 'Data product does not exist.', name: 'Error', errorId: expect.stringMatching(/\w{10}/) };

const getDataProductResponse: DataProduct = {
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
          ontologyNamespace: 'namespace',
        },
        lastName: {
          description: 'The customer last name',
          dataType: 'string',
          ontologyAttributeId: 'name-attribute-id',
          ontologyNamespace: 'namespace',
        },
        email: { description: 'The customer email', dataType: 'string' },
        age: { description: 'The customer age', dataType: 'bigint' },
      },
    },
  },
};

const getDataProductWithPiiResponse: DataProduct = {
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
          ontologyNamespace: 'namespace',
          piiClassification: 'NAME',
        },
        lastName: {
          description: 'The customer last name',
          dataType: 'string',
          ontologyAttributeId: 'name-attribute-id',
          ontologyNamespace: 'namespace',
          piiClassification: 'NAME',
        },
        email: { description: 'The customer email', dataType: 'string' },
        age: { description: 'The customer age', dataType: 'bigint' },
      },
    },
  },
};

const emptyAttributePolicies: GetGovernancePolicyAttributesResponse = {
  attributeIdToLensId: {},
};

const emptyAttributeValuePolicies: GetGovernancePolicyAttributeValuesResponse = {
  attributeIdToSqlClause: {},
};

const emptyDatasetResponse: DataProduct = {
  ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
  domainId: 'default',
  dataProductId: 'test',
  dataSets: {},
};

const multipleDatasetResponse: DataProduct = {
  ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
  domainId: 'default',
  dataProductId: 'test',
  dataSets: {
    myDataSetOne: {
      identifiers: {
        catalog: 'AwsDataCatalog',
        database: 'default',
        table: 'test.myDataSetOne',
      },
      columnMetadata: {
        firstName: {
          description: 'The customer first name',
          dataType: 'string',
          ontologyAttributeId: 'name-attribute-id',
          ontologyNamespace: 'namespace',
        },
        lastName: {
          description: 'The customer last name',
          dataType: 'string',
          ontologyAttributeId: 'name-attribute-id',
          ontologyNamespace: 'namespace',
        },
        email: { description: 'The customer email', dataType: 'string' },
      },
    },
    myDataSetTwo: {
      identifiers: {
        catalog: 'AwsDataCatalog',
        database: 'default',
        table: 'test.myDataSetTwo',
      },
      columnMetadata: {
        firstName: {
          description: 'The customer first name',
          dataType: 'string',
          ontologyAttributeId: 'name-attribute-id',
          ontologyNamespace: 'namespace',
        },
      },
    },
  },
};
const multipleDatasetWithPiiResponse: DataProduct = {
  ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
  domainId: 'default',
  dataProductId: 'test',
  dataSets: {
    myDataSetOne: {
      identifiers: {
        catalog: 'AwsDataCatalog',
        database: 'default',
        table: 'test.myDataSetOne',
      },
      columnMetadata: {
        firstName: {
          description: 'The customer first name',
          dataType: 'string',
          ontologyAttributeId: 'NAME',
          ontologyNamespace: OntologyNamespace.PII_CLASSIFICATIONS,
          piiClassification: 'NAME',
        },
        lastName: {
          description: 'The customer last name',
          dataType: 'string',
          ontologyAttributeId: 'NAME',
          ontologyNamespace: OntologyNamespace.PII_CLASSIFICATIONS,
          piiClassification: 'NAME',
        },
        email: { description: 'The customer email', dataType: 'string' },
      },
    },
    myDataSetTwo: {
      identifiers: {
        catalog: 'AwsDataCatalog',
        database: 'default',
        table: 'test.myDataSetTwo',
      },
      columnMetadata: {
        firstName: {
          description: 'The customer first name',
          dataType: 'string',
          ontologyAttributeId: 'NAME',
          ontologyNamespace: OntologyNamespace.PII_CLASSIFICATIONS,
          piiClassification: 'NAME',
        },
      },
    },
  },
};

const getOntologyResponse: OntologyEntity = {
  ontologyNamespace: OntologyNamespace.PII_CLASSIFICATIONS,
  aliases: [],
  ontologyId: 'NAME',
  name: 'NAME',
  defaultLens: LensIds.HASHED,
};

const getDataProductPolicy: DataProductPermissions = {
  admin: {
    access: DataProductAccess.FULL,
  },
};

const successHandlerEvent = {
  httpMethod: 'POST',
  body: JSON.stringify({ query: 'SELECT talker from default.test.myDataSetOne' }),
};

describe('generate-query', () => {
  const now = '2021-01-01T00:00:00.000Z';

  let testCachedStore: CachedQueryStore;

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);

    // Mock the dataProduct store to point to our local dynamodb
    testCachedStore = new (CachedQueryStore as any)(getLocalDynamoDocumentClient());
    CachedQueryStore.getInstance = jest.fn(() => testCachedStore);

    jest.clearAllMocks();
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
  })

  afterEach(async () => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should render a valid query', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductResponse as any);
    API.getOntology.mockResolvedValue(getOntologyResponse);
    API.getGovernancePolicyAttributes.mockResolvedValue(emptyAttributePolicies);
    API.getGovernancePolicyAttributeValues.mockResolvedValue(emptyAttributeValuePolicies);
    API.getGovernancePolicyDefaultLensDomainDataProduct.mockRejectedValue({ status: 404 });
    API.postQueryParseRenderRewrite.mockResolvedValue({ query: 'SELECT * from governed.query' });

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    expect(response.statusCode).toBe(200);

    expect(API.postQueryParseRenderRewrite).toHaveBeenCalledWith<[ApiOperationRequest<'postQueryParseRenderRewrite'>]>({
      queryRewriteInput: {
        query: JSON.parse(successHandlerEvent.body).query,
        querySubstitutions: {},
        dataProducts: {
          'default.test': {
            tableName: '"AwsDataCatalog"."default"."test"',
            columns: [
              {
                name: 'firstName',
                udfs: [],
                clauses: [],
                attribute: 'name-attribute-id',
              },
              {
                name: 'lastName',
                udfs: [],
                clauses: [],
                attribute: 'name-attribute-id',
              },
              {
                name: 'email',
                udfs: [],
                clauses: [],
              },
              {
                name: 'age',
                udfs: [],
                clauses: [],
              },
            ],
          },
        },
      },
    });

    // expect there will be a query key in the final response object
    expect(JSON.parse(response.body).query).toBeDefined();
  });

  it('should render a valid query referencing a query', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponseWithQueries);
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductResponse as any);
    API.getOntology.mockResolvedValue(getOntologyResponse);
    API.getGovernancePolicyAttributes.mockResolvedValue(emptyAttributePolicies);
    API.getGovernancePolicyAttributeValues.mockResolvedValue(emptyAttributeValuePolicies);
    API.getGovernancePolicyDefaultLensDomainDataProduct.mockRejectedValue({ status: 404 });
    const substitutedQuery = `select * from default.test inner join ${toQueryAddressedAs(
      {
        namespace: 'default',
        queryId: 'test_2',
      },
      DEFAULT_CALLER,
    )} on foo = bar`;
    API.getQuerySavedQuery
      .mockResolvedValueOnce({
        addressedAs: toQueryAddressedAs({ namespace: 'test-user', queryId: 'test_1' }, DEFAULT_CALLER),
        namespace: 'test-user',
        queryId: 'test_1',
        query: substitutedQuery,
        referencedQueries: [{ namespace: 'default', queryId: 'test_2' }],
        referencedDataSets: [
          { dataSetId: DataSetIds.DEFAULT, dataProductId: 'test', domainId: 'default', addressedAs: 'default.test' },
        ],
      } as SavedQuery)
      .mockResolvedValueOnce({
        addressedAs: toQueryAddressedAs({ namespace: 'default', queryId: 'test_2' }, DEFAULT_CALLER),
        namespace: 'default',
        queryId: 'test_2',
        query: substitutedQuery,
        referencedQueries: [] as SavedQueryIdentifier[],
        referencedDataSets: [
          { dataSetId: DataSetIds.DEFAULT, dataProductId: 'test', domainId: 'default', addressedAs: 'default.test' },
        ],
      } as SavedQuery);
    API.postQueryParseRenderRewrite.mockResolvedValue({ query: 'SELECT * from governed.query' });

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    expect(response.statusCode).toBe(200);

    expect(API.postQueryParseRenderRewrite).toHaveBeenCalledWith<[ApiOperationRequest<'postQueryParseRenderRewrite'>]>({
      queryRewriteInput: {
        query: JSON.parse(successHandlerEvent.body).query,
        querySubstitutions: {
          [toQueryAddressedAs({ namespace: 'test-user', queryId: 'test_1' }, DEFAULT_CALLER)]: {
            query: substitutedQuery,
          },
          [toQueryAddressedAs({ namespace: 'default', queryId: 'test_2' }, DEFAULT_CALLER)]: {
            query: substitutedQuery,
          },
        },
        dataProducts: {
          'default.test': {
            tableName: '"AwsDataCatalog"."default"."test"',
            columns: [
              {
                name: 'firstName',
                udfs: [],
                clauses: [],
                attribute: 'name-attribute-id',
              },
              {
                name: 'lastName',
                udfs: [],
                clauses: [],
                attribute: 'name-attribute-id',
              },
              {
                name: 'email',
                udfs: [],
                clauses: [],
              },
              {
                name: 'age',
                udfs: [],
                clauses: [],
              },
            ],
          },
        },
      },
    });

    // expect there will be a query key in the final response object
    expect(JSON.parse(response.body).query).toBeDefined();
  });

  it('should render a valid query with multiple datasets in a single data product', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue({
      tables: [
        { identifierParts: ['default', 'test', 'myDataSetOne'] },
        { identifierParts: ['default', 'test', 'myDataSetTwo'] },
      ],
    });
    API.getDataProductDomainDataProduct.mockResolvedValue(multipleDatasetResponse as any);
    API.getOntology.mockResolvedValue(getOntologyResponse);
    API.getGovernancePolicyAttributes.mockResolvedValue(emptyAttributePolicies);
    API.getGovernancePolicyAttributeValues.mockResolvedValue(emptyAttributeValuePolicies);
    API.getGovernancePolicyDefaultLensDomainDataProduct.mockRejectedValue({ status: 404 });
    API.postQueryParseRenderRewrite.mockResolvedValue({ query: 'SELECT * from governed.query' });

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    expect(response.statusCode).toBe(200);

    expect(API.postQueryParseRenderRewrite).toHaveBeenCalledWith<[ApiOperationRequest<'postQueryParseRenderRewrite'>]>({
      queryRewriteInput: {
        query: JSON.parse(successHandlerEvent.body).query,
        querySubstitutions: {},
        dataProducts: {
          'default.test.myDataSetOne': {
            tableName: '"AwsDataCatalog"."default"."test.myDataSetOne"',
            columns: [
              {
                name: 'firstName',
                udfs: [],
                clauses: [],
                attribute: 'name-attribute-id',
              },
              {
                name: 'lastName',
                udfs: [],
                clauses: [],
                attribute: 'name-attribute-id',
              },
              {
                name: 'email',
                udfs: [],
                clauses: [],
              },
            ],
          },
          'default.test.myDataSetTwo': {
            tableName: '"AwsDataCatalog"."default"."test.myDataSetTwo"',
            columns: [
              {
                name: 'firstName',
                udfs: [],
                clauses: [],
                attribute: 'name-attribute-id',
              },
            ],
          },
        },
      },
    });

    // expect there will be a query key in the final response object
    expect(JSON.parse(response.body).query).toBeDefined();

    // We should only have requested the data product once since both datasets are from the same data product
    expect(API.getDataProductDomainDataProduct).toHaveBeenCalledTimes(1);
  });

  it('should render a valid query with multiple datasets in a single data product with pii classification', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue({
      tables: [
        { identifierParts: ['default', 'test', 'myDataSetOne'] },
        { identifierParts: ['default', 'test', 'myDataSetTwo'] },
      ],
    });
    API.getDataProductDomainDataProduct.mockResolvedValue(multipleDatasetWithPiiResponse);
    API.getOntology.mockResolvedValue(getOntologyResponse);
    API.getGovernancePolicyAttributes.mockResolvedValue(emptyAttributePolicies);
    API.getGovernancePolicyAttributeValues.mockResolvedValue(emptyAttributeValuePolicies);
    API.getGovernancePolicyDefaultLensDomainDataProduct.mockRejectedValue({ status: 404 });
    API.postQueryParseRenderRewrite.mockResolvedValue({ query: 'SELECT * from governed.query' });

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    expect(response.statusCode).toBe(200);

    expect(API.postQueryParseRenderRewrite).toHaveBeenCalledWith<[ApiOperationRequest<'postQueryParseRenderRewrite'>]>({
      queryRewriteInput: {
        query: JSON.parse(successHandlerEvent.body).query,
        querySubstitutions: {},
        dataProducts: {
          'default.test.myDataSetOne': {
            tableName: '"AwsDataCatalog"."default"."test.myDataSetOne"',
            columns: [
              {
                name: 'firstName',
                udfs: [UdfHash],
                clauses: [],
                attribute: 'NAME',
              },
              {
                name: 'lastName',
                udfs: [UdfHash],
                clauses: [],
                attribute: 'NAME',
              },
              {
                name: 'email',
                udfs: [],
                clauses: [],
              },
            ],
          },
          'default.test.myDataSetTwo': {
            tableName: '"AwsDataCatalog"."default"."test.myDataSetTwo"',
            columns: [
              {
                name: 'firstName',
                udfs: [UdfHash],
                clauses: [],
                attribute: 'NAME',
              },
            ],
          },
        },
      },
    });

    // expect there will be a query key in the final response object
    expect(JSON.parse(response.body).query).toBeDefined();

    // We should only have requested the data product once since both datasets are from the same data product
    expect(API.getDataProductDomainDataProduct).toHaveBeenCalledTimes(1);
  });

  it('should render a valid query for the source data of a data product', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue({
      tables: [{ identifierParts: [ReservedDomains.SOURCE, 'default', 'test'] }],
    });
    API.getDataProductDomainDataProduct.mockResolvedValue({
      ...getDataProductResponse,
      createdBy: DEFAULT_CALLER.userId,
      sourceDataSets: {
        someSourceDataSet: {
          identifiers: {
            catalog: 'AwsDataCatalog',
            database: 'default',
            table: 'source_test',
          },
          columnMetadata: {
            field: {
              description: 'Some field',
              dataType: 'string',
            },
          },
        },
      },
    });
    API.getOntology.mockResolvedValue(getOntologyResponse);
    API.getGovernancePolicyAttributes.mockResolvedValue(emptyAttributePolicies);
    API.getGovernancePolicyAttributeValues.mockResolvedValue(emptyAttributeValuePolicies);
    API.getGovernancePolicyDefaultLensDomainDataProduct.mockRejectedValue({ status: 404 });
    API.postQueryParseRenderRewrite.mockResolvedValue({ query: 'SELECT * from governed.query' });

    const query = 'select * from source.default.test';
    const response = await generateQuery.handler(
      buildApiRequest(DEFAULT_CALLER, {
        body: { query },
      }) as any,
      null,
    );

    expect(response.statusCode).toBe(200);

    expect(API.postQueryParseRenderRewrite).toHaveBeenCalledWith<[ApiOperationRequest<'postQueryParseRenderRewrite'>]>({
      queryRewriteInput: {
        query,
        querySubstitutions: {},
        dataProducts: {
          'source.default.test': {
            tableName: '"AwsDataCatalog"."default"."source_test"',
            columns: [
              {
                name: 'field',
                udfs: [],
                clauses: [],
              },
            ],
          },
        },
      },
    });

    // expect there will be a query key in the final response object
    expect(JSON.parse(response.body).query).toBeDefined();
  });

  it('should return the data products and governed datasets', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue({
      tables: [
        { identifierParts: ['default', 'test', 'myDataSetOne'] },
        { identifierParts: ['default', 'test', 'myDataSetTwo'] },
      ],
    });
    API.getDataProductDomainDataProduct.mockResolvedValue(multipleDatasetResponse as any);
    API.getOntology.mockResolvedValue(getOntologyResponse);
    API.getGovernancePolicyAttributes.mockResolvedValue(emptyAttributePolicies);
    API.getGovernancePolicyAttributeValues.mockResolvedValue(emptyAttributeValuePolicies);
    API.getGovernancePolicyDefaultLensDomainDataProduct.mockRejectedValue({ status: 404 });
    API.postQueryParseRenderRewrite.mockResolvedValue({ query: 'SELECT * from governed.query' });

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    expect(response.statusCode).toBe(200);

    const result = JSON.parse(response.body);
    expect(result.dataProducts).toEqual([multipleDatasetResponse]);
    expect(result.governedDataSets).toEqual([
      {
        addressedAs: 'default.test.myDataSetOne',
        domainId: 'default',
        dataProductId: 'test',
        dataSetId: 'myDataSetOne',
        dataSet: {
          columnMetadata: {
            email: {
              dataType: 'string',
              description: 'The customer email',
              lensToApply: 'clear',
              sqlClauses: [],
            },
            firstName: {
              dataType: 'string',
              description: 'The customer first name',
              lensToApply: 'clear',
              ontologyAttributeId: 'name-attribute-id',
              ontologyNamespace: 'namespace',
              sqlClauses: [],
            },
            lastName: {
              dataType: 'string',
              description: 'The customer last name',
              lensToApply: 'clear',
              ontologyAttributeId: 'name-attribute-id',
              ontologyNamespace: 'namespace',
              sqlClauses: [],
            },
          },
          identifiers: {
            catalog: 'AwsDataCatalog',
            database: 'default',
            table: 'test.myDataSetOne',
          },
        },
      },
      {
        addressedAs: 'default.test.myDataSetTwo',
        domainId: 'default',
        dataProductId: 'test',
        dataSetId: 'myDataSetTwo',
        dataSet: {
          columnMetadata: {
            firstName: {
              dataType: 'string',
              description: 'The customer first name',
              lensToApply: 'clear',
              ontologyAttributeId: 'name-attribute-id',
              ontologyNamespace: 'namespace',
              sqlClauses: [],
            },
          },
          identifiers: {
            catalog: 'AwsDataCatalog',
            database: 'default',
            table: 'test.myDataSetTwo',
          },
        },
      },
    ]);
  });

  it('should render a valid query with attribute policies', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductResponse as any);
    API.getOntology.mockResolvedValue(getOntologyResponse);
    API.getGovernancePolicyAttributes.mockResolvedValue({
      attributeIdToLensId: {
        'namespace.name-attribute-id': LensIds.HASHED,
      },
    });
    API.getGovernancePolicyAttributeValues.mockResolvedValue(emptyAttributeValuePolicies);
    API.getGovernancePolicyDefaultLensDomainDataProduct.mockRejectedValue({ status: 404 });
    API.postQueryParseRenderRewrite.mockResolvedValue({ query: 'SELECT * from governed.query' });

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    expect(response.statusCode).toBe(200);

    expect(API.postQueryParseRenderRewrite).toHaveBeenCalledWith<[ApiOperationRequest<'postQueryParseRenderRewrite'>]>({
      queryRewriteInput: {
        query: JSON.parse(successHandlerEvent.body).query,
        querySubstitutions: {},
        dataProducts: {
          'default.test': {
            tableName: '"AwsDataCatalog"."default"."test"',
            columns: [
              {
                name: 'firstName',
                udfs: [UdfHash],
                clauses: [],
                attribute: 'name-attribute-id',
              },
              {
                name: 'lastName',
                udfs: [UdfHash],
                clauses: [],
                attribute: 'name-attribute-id',
              },
              {
                name: 'email',
                udfs: [],
                clauses: [],
              },
              {
                name: 'age',
                udfs: [],
                clauses: [],
              },
            ],
          },
        },
      },
    });

    // expect there will be a query key in the final response object
    expect(JSON.parse(response.body).query).toBeDefined();
  });

  it('should render a valid query with attribute policies taking precredence over pii', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductWithPiiResponse as any);
    API.getOntology.mockResolvedValue(getOntologyResponse);
    API.getGovernancePolicyAttributes.mockResolvedValue({
      attributeIdToLensId: {
        'namespace.name-attribute-id': LensIds.CLEAR,
      },
    });
    API.getGovernancePolicyAttributeValues.mockResolvedValue(emptyAttributeValuePolicies);
    API.getGovernancePolicyDefaultLensDomainDataProduct.mockRejectedValue({ status: 404 });
    API.postQueryParseRenderRewrite.mockResolvedValue({ query: 'SELECT * from governed.query' });

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    expect(response.statusCode).toBe(200);

    expect(API.postQueryParseRenderRewrite).toHaveBeenCalledWith<[ApiOperationRequest<'postQueryParseRenderRewrite'>]>({
      queryRewriteInput: {
        query: JSON.parse(successHandlerEvent.body).query,
        querySubstitutions: {},
        dataProducts: {
          'default.test': {
            tableName: '"AwsDataCatalog"."default"."test"',
            columns: [
              {
                name: 'firstName',
                udfs: [],
                clauses: [],
                attribute: 'name-attribute-id',
              },
              {
                name: 'lastName',
                udfs: [],
                clauses: [],
                attribute: 'name-attribute-id',
              },
              {
                name: 'email',
                udfs: [],
                clauses: [],
              },
              {
                name: 'age',
                udfs: [],
                clauses: [],
              },
            ],
          },
        },
      },
    });

    // expect there will be a query key in the final response object
    expect(JSON.parse(response.body).query).toBeDefined();
  });

  it('should render a valid query with attribute value policies', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductResponse as any);
    API.getOntology.mockResolvedValue(getOntologyResponse);
    API.getGovernancePolicyAttributes.mockResolvedValue(emptyAttributePolicies);
    API.getGovernancePolicyAttributeValues
      .mockResolvedValueOnce({
        attributeIdToSqlClause: {
          'namespace.name-attribute-id': 'name-attribute-id LIKE "%vader"',
        },
      })
      .mockResolvedValue(emptyAttributeValuePolicies);
    API.getGovernancePolicyDefaultLensDomainDataProduct.mockRejectedValue({ status: 404 });
    API.postQueryParseRenderRewrite.mockResolvedValue({ query: 'SELECT * from governed.query' });

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    expect(response.statusCode).toBe(200);

    expect(API.postQueryParseRenderRewrite).toHaveBeenCalledWith<[ApiOperationRequest<'postQueryParseRenderRewrite'>]>({
      queryRewriteInput: {
        query: JSON.parse(successHandlerEvent.body).query,
        querySubstitutions: {},
        dataProducts: {
          'default.test': {
            tableName: '"AwsDataCatalog"."default"."test"',
            columns: [
              {
                name: 'firstName',
                udfs: [],
                clauses: ['name-attribute-id LIKE "%vader"'],
                attribute: 'name-attribute-id',
              },
              {
                name: 'lastName',
                udfs: [],
                clauses: ['name-attribute-id LIKE "%vader"'],
                attribute: 'name-attribute-id',
              },
              {
                name: 'email',
                udfs: [],
                clauses: [],
              },
              {
                name: 'age',
                udfs: [],
                clauses: [],
              },
            ],
          },
        },
      },
    });

    // expect there will be a query key in the final response object
    expect(JSON.parse(response.body).query).toBeDefined();
  });

  it('should render a valid query with attribute value policies where multiple groups match', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductResponse as any);
    API.getOntology.mockResolvedValue(getOntologyResponse);
    API.getGovernancePolicyAttributes.mockResolvedValue(emptyAttributePolicies);
    API.getGovernancePolicyAttributeValues
      .mockResolvedValueOnce({
        attributeIdToSqlClause: {
          'namespace.name-attribute-id': 'name-attribute-id LIKE "%vader"',
        },
      })
      .mockResolvedValueOnce({
        attributeIdToSqlClause: {
          'namespace.name-attribute-id': 'name-attribute-id LIKE "%skywalker"',
        },
      });
    API.getGovernancePolicyDefaultLensDomainDataProduct.mockRejectedValue({ status: 404 });
    API.postQueryParseRenderRewrite.mockResolvedValue({ query: 'SELECT * from governed.query' });

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    expect(response.statusCode).toBe(200);

    expect(API.postQueryParseRenderRewrite).toHaveBeenCalledWith<[ApiOperationRequest<'postQueryParseRenderRewrite'>]>({
      queryRewriteInput: {
        query: JSON.parse(successHandlerEvent.body).query,
        querySubstitutions: {},
        dataProducts: {
          'default.test': {
            tableName: '"AwsDataCatalog"."default"."test"',
            columns: [
              {
                name: 'firstName',
                udfs: [],
                clauses: ['name-attribute-id LIKE "%vader"', 'name-attribute-id LIKE "%skywalker"'],
                attribute: 'name-attribute-id',
              },
              {
                name: 'lastName',
                udfs: [],
                clauses: ['name-attribute-id LIKE "%vader"', 'name-attribute-id LIKE "%skywalker"'],
                attribute: 'name-attribute-id',
              },
              {
                name: 'email',
                udfs: [],
                clauses: [],
              },
              {
                name: 'age',
                udfs: [],
                clauses: [],
              },
            ],
          },
        },
      },
    });

    // expect there will be a query key in the final response object
    expect(JSON.parse(response.body).query).toBeDefined();
  });

  it('should apply the least restrictive attribute policy', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductResponse as any);
    API.getOntology.mockResolvedValue(getOntologyResponse);
    API.getGovernancePolicyAttributes.mockResolvedValueOnce({
      attributeIdToLensId: {
        'namespace.name-attribute-id': LensIds.HIDDEN,
      },
    });
    API.getGovernancePolicyAttributes.mockResolvedValueOnce({
      attributeIdToLensId: {
        'namespace.name-attribute-id': LensIds.HASHED,
      },
    });
    API.getGovernancePolicyAttributeValues.mockResolvedValue(emptyAttributeValuePolicies);
    API.getGovernancePolicyDefaultLensDomainDataProduct.mockRejectedValue({ status: 404 });
    API.postQueryParseRenderRewrite.mockResolvedValue({ query: 'SELECT * from governed.query' });

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    expect(response.statusCode).toBe(200);

    expect(API.postQueryParseRenderRewrite).toHaveBeenCalledWith<[ApiOperationRequest<'postQueryParseRenderRewrite'>]>({
      queryRewriteInput: {
        query: JSON.parse(successHandlerEvent.body).query,
        querySubstitutions: {},
        dataProducts: {
          'default.test': {
            tableName: '"AwsDataCatalog"."default"."test"',
            columns: [
              {
                name: 'firstName',
                udfs: [UdfHash],
                clauses: [],
                attribute: 'name-attribute-id',
              },
              {
                name: 'lastName',
                udfs: [UdfHash],
                clauses: [],
                attribute: 'name-attribute-id',
              },
              {
                name: 'email',
                udfs: [],
                clauses: [],
              },
              {
                name: 'age',
                udfs: [],
                clauses: [],
              },
            ],
          },
        },
      },
    });

    // expect there will be a query key in the final response object
    expect(JSON.parse(response.body).query).toBeDefined();
  });

  it('should apply the hidden lens', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductResponse as any);
    API.getOntology.mockResolvedValue(getOntologyResponse);
    API.getGovernancePolicyAttributes.mockResolvedValue({
      attributeIdToLensId: {
        'namespace.name-attribute-id': LensIds.HIDDEN,
      },
    });
    API.getGovernancePolicyAttributeValues.mockResolvedValue(emptyAttributeValuePolicies);
    API.getGovernancePolicyDefaultLensDomainDataProduct.mockRejectedValue({ status: 404 });
    API.postQueryParseRenderRewrite.mockResolvedValue({ query: 'SELECT * from governed.query' });

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    expect(response.statusCode).toBe(200);

    expect(API.postQueryParseRenderRewrite).toHaveBeenCalledWith<[ApiOperationRequest<'postQueryParseRenderRewrite'>]>({
      queryRewriteInput: {
        query: JSON.parse(successHandlerEvent.body).query,
        querySubstitutions: {},
        dataProducts: {
          'default.test': {
            tableName: '"AwsDataCatalog"."default"."test"',
            columns: [
              {
                name: 'email',
                udfs: [],
                clauses: [],
              },
              {
                name: 'age',
                udfs: [],
                clauses: [],
              },
            ],
          },
        },
      },
    });

    // expect there will be a query key in the final response object
    expect(JSON.parse(response.body).query).toBeDefined();
  });

  it('should apply default lens policies where attribute policies do not match', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductResponse as any);
    API.getOntology.mockResolvedValue(getOntologyResponse);
    API.getGovernancePolicyAttributes.mockResolvedValue({
      attributeIdToLensId: {
        'namespace.name-attribute-id': LensIds.HASHED,
      },
    });
    API.getGovernancePolicyDefaultLensDomainDataProduct.mockResolvedValue({
      domainId: 'default',
      dataProductId: 'test',
      defaultLensId: LensIds.HIDDEN,
      defaultLensOverrides: {},
    });
    API.getGovernancePolicyAttributeValues.mockResolvedValue(emptyAttributeValuePolicies);
    API.postQueryParseRenderRewrite.mockResolvedValue({ query: 'SELECT * from governed.query' });

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    expect(response.statusCode).toBe(200);

    expect(API.postQueryParseRenderRewrite).toHaveBeenCalledWith<[ApiOperationRequest<'postQueryParseRenderRewrite'>]>({
      queryRewriteInput: {
        query: JSON.parse(successHandlerEvent.body).query,
        querySubstitutions: {},
        dataProducts: {
          'default.test': {
            tableName: '"AwsDataCatalog"."default"."test"',
            columns: [
              {
                name: 'firstName',
                udfs: [UdfHash],
                clauses: [],
                attribute: 'name-attribute-id',
              },
              {
                name: 'lastName',
                udfs: [UdfHash],
                clauses: [],
                attribute: 'name-attribute-id',
              },
              // email and age are missing as default lens id is HIDDEN
            ],
          },
        },
      },
    });

    // expect there will be a query key in the final response object
    expect(JSON.parse(response.body).query).toBeDefined();
  });

  it('should apply default lens policy overrides where attribute policies do not match', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductResponse as any);
    API.getOntology.mockResolvedValue(getOntologyResponse);
    API.getGovernancePolicyAttributes.mockResolvedValue({
      attributeIdToLensId: {
        'namespace.name-attribute-id': LensIds.HASHED,
      },
    });
    API.getGovernancePolicyDefaultLensDomainDataProduct.mockResolvedValue({
      domainId: 'default',
      dataProductId: 'test',
      defaultLensId: LensIds.HIDDEN,
      defaultLensOverrides: {
        admin: LensIds.HASHED,
      },
    });

    API.getGovernancePolicyAttributeValues.mockResolvedValue(emptyAttributeValuePolicies);
    API.postQueryParseRenderRewrite.mockResolvedValue({ query: 'SELECT * from governed.query' });

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    expect(response.statusCode).toBe(200);

    expect(API.postQueryParseRenderRewrite).toHaveBeenCalledWith<[ApiOperationRequest<'postQueryParseRenderRewrite'>]>({
      queryRewriteInput: {
        query: JSON.parse(successHandlerEvent.body).query,
        querySubstitutions: {},
        dataProducts: {
          'default.test': {
            tableName: '"AwsDataCatalog"."default"."test"',
            columns: [
              {
                name: 'firstName',
                udfs: [UdfHash],
                clauses: [],
                attribute: 'name-attribute-id',
              },
              {
                name: 'lastName',
                udfs: [UdfHash],
                clauses: [],
                attribute: 'name-attribute-id',
              },
              // Hash lens applied to email since the user is in the admin group
              {
                name: 'email',
                udfs: [UdfHash],
                clauses: [],
              },
              // Hash lens is also applied to age since the user is in the admin group
              {
                name: 'age',
                udfs: [UdfHash],
                clauses: [],
              },
            ],
          },
        },
      },
    });

    // expect there will be a query key in the final response object
    expect(JSON.parse(response.body).query).toBeDefined();
  });

  it('should return failed response if request to /discover api fails', async () => {
    API.postQueryParseRenderDiscover.mockRejectedValue(badRequestResponse);

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(badRequestResponse);
  });

  it('should return failed response if request to /data-product api fails', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
    API.getDataProductDomainDataProduct.mockRejectedValue(badRequestResponse);

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(badRequestResponse);
  });

  it('should return failed response if request to governance api for attribute policies fails', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductResponse as any);
    API.getOntology.mockResolvedValue(getOntologyResponse);
    API.getGovernancePolicyAttributes.mockRejectedValue(badRequestResponse);
    API.getGovernancePolicyAttributeValues.mockResolvedValue(emptyAttributeValuePolicies);

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(badRequestResponse);
  });

  it('should return failed response if request to /rewrite api fails', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
    API.getDataProductDomainDataProduct.mockResolvedValue(getDataProductResponse as any);
    API.getOntology.mockResolvedValue(getOntologyResponse);
    API.getGovernancePolicyAttributes.mockResolvedValue(emptyAttributePolicies);
    API.getGovernancePolicyAttributeValues.mockResolvedValue(emptyAttributeValuePolicies);
    API.postQueryParseRenderRewrite.mockRejectedValue(badRequestResponse);

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(badRequestResponse);
  });

  it('should return failed response if dataset is empty in data products ', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
    API.getDataProductDomainDataProduct.mockResolvedValue(emptyDatasetResponse as any);

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    const body = JSON.parse(response.body);

    // expect there will NOT be a query key in the final response object
    expect(body.query).toBeUndefined();
    expect(body.message).toContain('No datasets were found to query');
  });

  it('should return failed response if multiple datasets in data products', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
    API.getDataProductDomainDataProduct.mockResolvedValue(multipleDatasetResponse as any);

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    const body = JSON.parse(response.body);
    // expect there will NOT be a query key in the final response object
    expect(body.query).toBeUndefined();
    expect(body.message).toContain('Must explicitly specify the dataset to query since there are multiple datasets');
  });

  it('should return failed response if wrong dataset id was provided', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue({
      tables: [{ identifierParts: ['default', 'test', 'wrong'] }],
    });
    API.getDataProductDomainDataProduct.mockResolvedValue(multipleDatasetResponse as any);

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    const body = JSON.parse(response.body);
    // expect there will NOT be a query key in the final response object
    expect(body.query).toBeUndefined();
    expect(body.message).toContain('Could not find a dataset with name');
  });

  it('should return failed response if not permitted to access data product', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue(queryDiscoverResponse);
    API.getDataProductDomainDataProduct.mockRejectedValue(
      apiClientErrorResponse(403, {
        message: 'Not permitted to access data product',
      }),
    );

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    const body = JSON.parse(response.body);
    // expect there will NOT be a query key in the final response object
    expect(body.query).toBeUndefined();
    expect(body.message).toContain('Not permitted to access data product');
  });

  it('should return failed response if trying to query the source of a data product and not owner', async () => {
    API.postQueryParseRenderDiscover.mockResolvedValue({
      tables: [{ identifierParts: [ReservedDomains.SOURCE, 'default', 'test'] }],
    });
    API.getDataProductDomainDataProduct.mockResolvedValue({
      ...getDataProductResponse,
      createdBy: 'darthvader',
      sourceDataSets: {
        someSourceDataSet: {
          identifiers: {
            catalog: 'AwsDataCatalog',
            database: 'default',
            table: 'source_test',
          },
          columnMetadata: {
            field: {
              description: 'Some field',
              dataType: 'string',
            },
          },
        },
      },
    });
    API.getOntology.mockResolvedValue(getOntologyResponse);
    API.getGovernancePolicyAttributes.mockResolvedValue(emptyAttributePolicies);
    API.getGovernancePolicyAttributeValues.mockResolvedValue(emptyAttributeValuePolicies);
    API.getGovernancePolicyDefaultLensDomainDataProduct.mockRejectedValue({ status: 404 });
    API.postQueryParseRenderRewrite.mockResolvedValue({ query: 'SELECT * from governed.query' });

    const response = await generateQuery.handler(apiGatewayEvent(successHandlerEvent), null);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).message).toInclude('You must be the owner to query source.default.test');
  });
});
