/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  DESCRIPTION_VALIDATION,
  ID_VALIDATION,
  NAME_VALIDATION,
  QueryExecutionStatus,
  SQL_CLAUSE_VALIDATION,
} from '@ada/common';
import {
  DataIntegrityProperty,
  PaginatedResponse,
  Tags,
  asEntity,
  asRef,
  extendSchema,
} from '../../../../common/constructs/api';
import { DataProduct, DataSetIdentifier, GovernedDataSetDetails } from '../../../data-product/api/types';
import { JsonSchema, JsonSchemaType } from 'aws-cdk-lib/aws-apigateway';

/**
 * Schema property for QueryExecutionStatus enum value.
 */
export const QueryExecutionStatusProperty: JsonSchema = {
  id: `${__filename}/QueryExecutionStatusEnum`,
  type: JsonSchemaType.STRING,
  description: 'Status for a query execution',
  enum: Object.values(QueryExecutionStatus),
};

/**
 * Schema for a query
 */
export const Query: JsonSchema = {
  id: `${__filename}/Query`,
  type: JsonSchemaType.OBJECT,
  properties: {
    query: {
      type: JsonSchemaType.STRING,
      description: 'An SQL query',
      ...SQL_CLAUSE_VALIDATION,
    },
  },
  required: ['query'],
};

export const GeneratedQuery: JsonSchema = extendSchema(
  {
    id: `${__filename}/GeneratedQuery`,
    type: JsonSchemaType.OBJECT,
    properties: {
      dataProducts: {
        type: JsonSchemaType.ARRAY,
        items: asRef(DataProduct),
        description: 'The data products involved in the query',
      },
      governedDataSets: {
        id: `${__filename}/GovernedDataSets`,
        type: JsonSchemaType.ARRAY,
        description: 'The data sets involved in the query, with their applied governance details',
        items: {
          id: `${__filename}/GovernedDataSet`,
          type: JsonSchemaType.OBJECT,
          properties: {
            domainId: {
              type: JsonSchemaType.STRING,
            },
            dataProductId: {
              type: JsonSchemaType.STRING,
            },
            dataSetId: {
              type: JsonSchemaType.STRING,
            },
            addressedAs: {
              type: JsonSchemaType.STRING,
            },
            dataSet: asRef(GovernedDataSetDetails),
          },
          required: ['domainId', 'dataProductId', 'dataSetId', 'addressedAs', 'dataSet'],
        },
      },
    },
    required: ['query', 'dataProducts', 'governedDataSets'],
    definitions: {
      DataProduct,
      GovernedDataSetDetails,
    },
  },
  Query,
);

/**
 * Schema for a query execution
 */
export const QueryExecution: JsonSchema = {
  id: `${__filename}/QueryExecution`,
  type: JsonSchemaType.OBJECT,
  properties: {
    executionId: {
      type: JsonSchemaType.STRING,
    },
  },
  required: ['executionId'],
};

/**
 * Schema for the status of a query
 */
export const QueryStatus: JsonSchema = {
  id: `${__filename}/QueryStatus`,
  type: JsonSchemaType.OBJECT,
  properties: {
    status: asRef(QueryExecutionStatusProperty),
    reason: {
      type: JsonSchemaType.STRING,
      description: 'Failure status reason',
    },
  },
  required: ['status'],
  definitions: {
    QueryExecutionStatusProperty,
  },
};

export const QueryResultData: JsonSchema = {
  id: `${__filename}/QueryResultData`,
  type: JsonSchemaType.OBJECT,
  additionalProperties: { type: JsonSchemaType.STRING },
};

export const QueryResultColumnMetadata: JsonSchema = {
  id: `${__filename}/QueryResultColumnMetadata`,
  type: JsonSchemaType.OBJECT,
  properties: {
    name: {
      type: JsonSchemaType.STRING,
    },
    label: {
      type: JsonSchemaType.STRING,
    },
    type: {
      type: JsonSchemaType.STRING,
    },
    precision: {
      type: JsonSchemaType.NUMBER,
      description: 'For decimal data types, specifies the total number of digits',
    },
    scale: {
      type: JsonSchemaType.NUMBER,
      description: 'For decimal data types, specifies the total number of digits in the fractional part of the value',
    },
    nullable: {
      type: JsonSchemaType.STRING,
    },
    caseSensitive: {
      type: JsonSchemaType.BOOLEAN,
    },
  },
  required: ['name', 'type'],
};

/**
 * Schema for a query result
 */
export const QueryResult: JsonSchema = {
  id: `${__filename}/QueryResult`,
  type: JsonSchemaType.OBJECT,
  properties: {
    data: {
      type: JsonSchemaType.ARRAY,
      items: asRef(QueryResultData),
    },
    dataIntegrity: asRef(DataIntegrityProperty),
    columns: {
      type: JsonSchemaType.ARRAY,
      items: asRef(QueryResultColumnMetadata),
    },
  },
  required: ['data', 'columns'],
  definitions: {
    QueryResultData,
    DataIntegrityProperty,
    QueryResultColumnMetadata,
  },
};

export const Schema: JsonSchema = {
  id: `${__filename}/Schema`,
  type: JsonSchemaType.OBJECT,
  additionalProperties: { type: JsonSchemaType.STRING },
};

/**
 * Schema for a data product schema
 */
export const QuerySchema: JsonSchema = {
  id: `${__filename}/QuerySchema`,
  type: JsonSchemaType.OBJECT,
  properties: {
    schema: asRef(Schema),
  },
  required: ['schema'],
  definitions: {
    Schema,
  },
};

/**
 * Schema for a paginated query result
 */
export const PaginatedQueryResult: JsonSchema = extendSchema(
  {
    id: `${__filename}/PaginatedQueryResult`,
    type: JsonSchemaType.OBJECT,
    properties: {
      error: { type: JsonSchemaType.STRING },
    },
  },
  QueryResult,
  PaginatedResponse,
);

/**
 * Schema for a query history
 */
export const QueryHistory: JsonSchema = extendSchema(
  {
    id: `${__filename}/QueryHistory`,
    type: JsonSchemaType.OBJECT,
    properties: {
      executionId: {
        type: JsonSchemaType.STRING,
      },
    },
    required: ['executionId'],
  },
  Query,
);

export const SavedQueryIdentifier: JsonSchema = {
  id: `${__filename}/SavedQueryIdentifier`,
  type: JsonSchemaType.OBJECT,
  properties: {
    namespace: {
      type: JsonSchemaType.STRING,
      description: 'The namespace for this query',
      ...ID_VALIDATION,
    },
    queryId: {
      type: JsonSchemaType.STRING,
      description: 'The id of the query within the namespace',
      ...ID_VALIDATION,
    },
  },
  required: ['namespace', 'queryId'],
};

export const ReferencedDataSetIdentifier: JsonSchema = extendSchema(
  {
    id: `${__filename}/ReferencedDataSetIdentifier`,
    type: JsonSchemaType.OBJECT,
    properties: {
      addressedAs: {
        type: JsonSchemaType.STRING,
        description: 'How the data set was referenced in a query',
        ...ID_VALIDATION,
      },
    },
    required: ['addressedAs'],
  },
  DataSetIdentifier,
);

/**
 * Schema for a public query scoped to a domain or a private query scoped to a user
 */
export const SavedQuery: JsonSchema = extendSchema(
  {
    id: `${__filename}/SavedQuery`,
    type: JsonSchemaType.OBJECT,
    properties: {
      type: {
        type: JsonSchemaType.STRING,
        enum: ['PUBLIC', 'PRIVATE'],
      },
      description: {
        type: JsonSchemaType.STRING,
        ...DESCRIPTION_VALIDATION,
      },
      addressedAs: {
        type: JsonSchemaType.STRING,
        ...NAME_VALIDATION,
      },
      referencedQueries: {
        type: JsonSchemaType.ARRAY,
        items: asRef(SavedQueryIdentifier),
      },
      referencedDataSets: {
        type: JsonSchemaType.ARRAY,
        items: asRef(ReferencedDataSetIdentifier),
      },
      tags: asRef(Tags),
    },
    required: ['type', 'addressedAs', 'referencedQueries', 'referencedDataSets'],
    definitions: {
      SavedQueryIdentifier,
      ReferencedDataSetIdentifier,
      Tags,
    },
  },
  SavedQueryIdentifier,
  Query,
);

export const SavedQueryList: JsonSchema = {
  id: `${__filename}/SavedQueryList`,
  type: JsonSchemaType.OBJECT,
  properties: {
    queries: {
      type: JsonSchemaType.ARRAY,
      items: asEntity(SavedQuery),
    },
  },
  required: ['queries'],
};

export const AthenaResultSetColumnInfo: JsonSchema = {
  id: `${__filename}/AthenaResultSetColumnInfo`,
  type: JsonSchemaType.OBJECT,
};

export const AthenaResultSetRowDatum: JsonSchema = {
  id: `${__filename}/AthenaResultSetRowDatum`,
  type: JsonSchemaType.OBJECT,
  properties: {
    VarCharValue: {
      type: JsonSchemaType.STRING,
    },
  },
};

export const AthenaResultSetRow: JsonSchema = {
  id: `${__filename}/AthenaResultSetRow`,
  type: JsonSchemaType.OBJECT,
  properties: {
    Data: {
      type: JsonSchemaType.ARRAY,
      items: asRef(AthenaResultSetRowDatum),
    },
  },
};

export const AthenaResultSet: JsonSchema = {
  id: `${__filename}/AthenaResultSet`,
  type: JsonSchemaType.OBJECT,
  properties: {
    ResultSetMetadata: {
      type: JsonSchemaType.OBJECT,
      properties: {
        ColumnInfo: {
          type: JsonSchemaType.ARRAY,
          items: asRef(AthenaResultSetColumnInfo),
        },
      },
    },
    Rows: {
      type: JsonSchemaType.ARRAY,
      items: asRef(AthenaResultSetRow),
    },
  },
};
