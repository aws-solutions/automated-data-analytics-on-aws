/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  ARN_RESOURCE_VALIDATION,
  DATA_TYPE_VALIDATION,
  DATE_VALIDATION,
  DESCRIPTION_VALIDATION,
  DataProductDataStatus,
  DataProductInfrastructureStatus,
  DataProductSourceDataStatus,
  DataProductUpdatePolicy,
  DataProductUpdateTriggerType,
  ID_VALIDATION,
  INLINE_SCRIPT_VALIDATION,
  NAME_VALIDATION,
  SCHEDULE_RATE_VALIDATION,
  SQL_CLAUSE_VALIDATION,
  StepFunctionExecutionStatus,
} from '@ada/common';
import {
  ApiError,
  LensProperty,
  SourceTypeProperty,
  Tags,
  asRef,
  extendSchema,
  refById,
} from '../../../common/constructs/api';
import { JsonSchema, JsonSchemaType } from 'aws-cdk-lib/aws-apigateway';

export * from '../script-validation/types';

const DataProductUpdateTriggerTypeProperty: JsonSchema = {
  id: `${__filename}/DataProductUpdateTriggerType`,
  type: JsonSchemaType.STRING,
  description: 'Trigger types for a data product data',
  enum: Object.values(DataProductUpdateTriggerType),
};

const DataProductUpdatePolicyTypeProperty: JsonSchema = {
  id: `${__filename}/DataProductUpdatePolicyType`,
  type: JsonSchemaType.STRING,
  description: 'Update types for a data product data',
  enum: Object.values(DataProductUpdatePolicy),
};

const DataProductInfrastructureStatusProperty: JsonSchema = {
  id: `${__filename}/DataProductInfrastructureStatus`,
  type: JsonSchemaType.STRING,
  description: 'Status of data product infrastructure',
  enum: Object.values(DataProductInfrastructureStatus),
};

const DataProductDataStatusProperty: JsonSchema = {
  id: `${__filename}/DataProductDataStatus`,
  type: JsonSchemaType.STRING,
  description: 'Status of data product data',
  enum: Object.values(DataProductDataStatus),
};

const DataProductSourceDataStatusProperty: JsonSchema = {
  id: `${__filename}/DataProductSourceDataStatus`,
  type: JsonSchemaType.STRING,
  description: 'Status of raw source data product data',
  enum: Object.values(DataProductSourceDataStatus),
};

export const DomainIdentifier: JsonSchema = {
  id: `${__filename}/DomainIdentifier`,
  type: JsonSchemaType.OBJECT,
  properties: {
    domainId: {
      type: JsonSchemaType.STRING,
      ...ID_VALIDATION,
    },
  },
  required: ['domainId'],
};

/**
 * The schema for a domain
 */
export const Domain: JsonSchema = extendSchema(
  {
    id: `${__filename}/Domain`,
    type: JsonSchemaType.OBJECT,
    properties: {
      name: {
        type: JsonSchemaType.STRING,
        ...NAME_VALIDATION,
      },
      description: {
        type: JsonSchemaType.STRING,
        ...DESCRIPTION_VALIDATION,
      },
    },
    required: ['name'],
  },
  DomainIdentifier,
);

export const DataSetIdentifiers: JsonSchema = {
  id: `${__filename}/DataSetIdentifiers`,
  type: JsonSchemaType.OBJECT,
  description: 'Details specific to attributes that identify the dataset',
  properties: {
    catalog: {
      type: JsonSchemaType.STRING,
      description: 'The catalog of the dataset',
      ...NAME_VALIDATION,
    },
    database: {
      type: JsonSchemaType.STRING,
      description: 'The database where the detaset is located',
      ...NAME_VALIDATION,
    },
    table: {
      type: JsonSchemaType.STRING,
      description: 'The name of the table that contains the data of the dataset',
      ...NAME_VALIDATION,
    },
  },
};

export const ColumnMetadata: JsonSchema = {
  id: `${__filename}/ColumnMetadata`,
  type: JsonSchemaType.OBJECT,
  properties: {
    ontologyAttributeId: {
      type: JsonSchemaType.STRING,
      description: 'The ontology attribute the column maps to (if any)',
      ...ID_VALIDATION,
    },
    ontologyNamespace: {
      type: JsonSchemaType.STRING,
      description: 'The ontologyNamespace of the ontology attribute',
      ...NAME_VALIDATION,
    },
    piiClassification: {
      type: JsonSchemaType.STRING,
      description: 'Pii classification of the column',
      ...NAME_VALIDATION,
    },
    description: {
      type: JsonSchemaType.STRING,
      description: 'A description of the column',
      ...DESCRIPTION_VALIDATION,
    },
    dataType: {
      type: JsonSchemaType.STRING,
      description: 'The data type of the column',
      ...DATA_TYPE_VALIDATION,
    },
    sortOrder: {
      type: JsonSchemaType.NUMBER,
      description: 'The order in which this column should appear in the schema and results',
    },
  },
  required: ['dataType'],
};

export const ColumnsMetadata: JsonSchema = {
  id: `${__filename}/ColumnsMetadata`,
  type: JsonSchemaType.OBJECT,
  additionalProperties: asRef(ColumnMetadata),
  description: 'A map of column name to metadata about the column',
  definitions: {
    ColumnMetadata,
  },
};

export const DataSetDetails: JsonSchema = {
  id: `${__filename}/DataSetDetails`,
  type: JsonSchemaType.OBJECT,
  properties: {
    name: {
      type: JsonSchemaType.STRING,
      description: 'The name of the dataset within the data product',
      ...NAME_VALIDATION,
    },
    description: {
      type: JsonSchemaType.STRING,
      description: 'A description of the dataset',
      ...DESCRIPTION_VALIDATION,
    },
    identifiers: asRef(DataSetIdentifiers),
  },
  required: ['identifiers'],
  definitions: {
    DataSetIdentifiers,
  },
};

export const DataSet: JsonSchema = extendSchema(
  {
    id: `${__filename}/DataSet`,
    type: JsonSchemaType.OBJECT,
    properties: {
      columnMetadata: asRef(ColumnsMetadata),
    },
    required: ['columnMetadata'],
    definitions: {
      ColumnsMetadata,
    },
  },
  DataSetDetails,
);

export const DataSets: JsonSchema = {
  id: `${__filename}/DataSets`,
  description: 'Map of datasets by id',
  type: JsonSchemaType.OBJECT,
  additionalProperties: asRef(DataSet),
  definitions: {
    DataSet,
  },
};

export const GovernedColumnMetadata: JsonSchema = extendSchema(
  {
    id: `${__filename}/GovernedColumnMetadata`,
    properties: {
      lensToApply: asRef(LensProperty),
      sqlClauses: {
        type: JsonSchemaType.ARRAY,
        items: {
          type: JsonSchemaType.STRING,
          ...SQL_CLAUSE_VALIDATION,
        },
      },
    },
    required: ['lensToApply', 'sqlClauses'],
    definitions: {
      LensProperty,
    },
  },
  ColumnMetadata,
);

export const GovernedDataSetDetails: JsonSchema = extendSchema(
  {
    id: `${__filename}/GovernedDataSetDetails`,
    type: JsonSchemaType.OBJECT,
    properties: {
      columnMetadata: {
        id: `${__filename}/GovernedColumnsMetadata`,
        type: JsonSchemaType.OBJECT,
        additionalProperties: asRef(GovernedColumnMetadata),
      },
    },
    required: ['columnMetadata', 'identifiers'],
    definitions: {
      GovernedColumnMetadata,
    },
  },
  DataSetDetails,
);

export const GovernedDataSetsDetails: JsonSchema = {
  id: `${__filename}/GovernedDataSetsDetails`,
  description: 'Map of datasets by id',
  type: JsonSchemaType.OBJECT,
  additionalProperties: asRef(GovernedDataSetDetails),
  definitions: {
    GovernedDataSetDetails,
  },
};

export const DataProductIdentifier: JsonSchema = {
  id: `${__filename}/DataProductIdentifier`,
  type: JsonSchemaType.OBJECT,
  properties: {
    dataProductId: {
      type: JsonSchemaType.STRING,
      description: 'The id of the data product',
      ...ID_VALIDATION,
    },
    domainId: {
      type: JsonSchemaType.STRING,
      description: 'The id of the domain to which this data product belongs',
      ...ID_VALIDATION,
    },
  },
  required: ['dataProductId', 'domainId'],
};

export const DataSetIdentifier: JsonSchema = extendSchema(
  {
    id: `${__filename}/DataSetIdentifier`,
    type: JsonSchemaType.OBJECT,
    properties: {
      dataSetId: {
        type: JsonSchemaType.STRING,
        description: 'The id of the data set',
        ...ID_VALIDATION,
      },
    },
    required: ['dataSetId'],
  },
  DataProductIdentifier,
);

export const ScriptIdentifier: JsonSchema = {
  id: `${__filename}/ScriptIdentifier`,
  type: JsonSchemaType.OBJECT,
  description: 'Uniquely identifies the script. Used to calculate the script path in s3',
  properties: {
    scriptId: {
      type: JsonSchemaType.STRING,
      description: 'Identifies the script within the namespace',
      ...ID_VALIDATION,
    },
    namespace: {
      type: JsonSchemaType.STRING,
      description: 'The namespace in which the script resides, eg the domain.',
      ...ID_VALIDATION,
    },
  },
  required: ['scriptId', 'namespace'],
};

export const DataProductTransform: JsonSchema = extendSchema(
  {
    id: `${__filename}/DataProductTransform`,
    type: JsonSchemaType.OBJECT,
    properties: {
      inlineScriptContent: {
        type: JsonSchemaType.STRING,
        description:
          'Inline script content for use in schema previews. Data products cannot be created with inline scripts.',
        ...INLINE_SCRIPT_VALIDATION,
      },
      inputArgs: {
        // type: of any objects
        description: 'Arguments to pass to the script',
      },
    },
  },
  ScriptIdentifier,
);

export const DataProductTransforms: JsonSchema = {
  id: `${__filename}/DataProductTransforms`,
  type: JsonSchemaType.ARRAY,
  description: 'Ordered list of transformations applied to data in the data product',
  items: asRef(DataProductTransform),
  definitions: {
    DataProductTransform,
  },
};

export const SouceDetailsSchema: JsonSchema = {
  id: `${__filename}/SouceDetailsSchema`,
  type: JsonSchemaType.OBJECT,
};

export const DataProductBase: JsonSchema = extendSchema(
  {
    id: `${__filename}/DataProductBase`,
    type: JsonSchemaType.OBJECT,
    properties: {
      name: {
        type: JsonSchemaType.STRING,
        description: 'The name of the data product',
        ...NAME_VALIDATION,
      },
      description: {
        type: JsonSchemaType.STRING,
        description: 'A description of the data product',
        ...DESCRIPTION_VALIDATION,
      },
      sourceType: asRef(SourceTypeProperty),
      sourceDetails: asRef(SouceDetailsSchema),
      tags: asRef(Tags),
      cloudFormationStackId: {
        type: JsonSchemaType.STRING,
        description: 'The id of the cloudformation stack for all resources pertaining to this data product',
        ...ARN_RESOURCE_VALIDATION,
      },
      dataImportStateMachineArn: {
        type: JsonSchemaType.STRING,
        description: 'The arn of the state machine for importing data product data (if any)',
      },
      infrastructureStatus: asRef(DataProductInfrastructureStatusProperty),
      infrastructureStatusDetails: {
        type: JsonSchemaType.STRING,
        description: 'Details about the infrastructure status of the data product, eg error message if creation failed',
        ...DESCRIPTION_VALIDATION,
      },
      dataStatus: asRef(DataProductDataStatusProperty),
      dataStatusDetails: {
        type: JsonSchemaType.STRING,
        description: 'Details about the data status of the data product, eg error message if data import failed',
        ...DESCRIPTION_VALIDATION,
      },
      sourceDataStatus: asRef(DataProductSourceDataStatusProperty),
      sourceDataStatusDetails: {
        type: JsonSchemaType.STRING,
        description:
          'Details about the raw source data status of the data product, eg error message if data source inference failed',
      },
      sourceDataSets: asRef(DataSets),
      latestDataUpdateTimestamp: {
        type: JsonSchemaType.STRING,
        description: 'The time at which the data product data was last updated',
        ...DATE_VALIDATION,
      },
      updateTrigger: {
        id: `${__filename}/DataProductUpdateTrigger`,
        type: JsonSchemaType.OBJECT,
        description: 'The trigger for a data update',
        properties: {
          triggerType: asRef(DataProductUpdateTriggerTypeProperty),
          scheduleRate: {
            type: JsonSchemaType.STRING,
            description: 'Cron schedule for data update (if triggerType is scheduled)',
            ...SCHEDULE_RATE_VALIDATION,
          },
          updatePolicy: asRef(DataProductUpdatePolicyTypeProperty),
        },
        required: ['triggerType'],
      },
      enableAutomaticTransforms: {
        type: JsonSchemaType.BOOLEAN,
        description: 'Whether or not to automatically apply transforms based on the type of data in the data product',
      },
      enableAutomaticPii: {
        type: JsonSchemaType.BOOLEAN,
        description: 'Whether or not to automatically apply pii detection and redaction',
      },
      transforms: asRef(DataProductTransforms),
      parentDataProducts: {
        type: JsonSchemaType.ARRAY,
        description:
          'Any parent data products, ie data products that are used as a source for data in this data product',
        items: asRef(DataProductIdentifier),
      },
      childDataProducts: {
        type: JsonSchemaType.ARRAY,
        description: 'Any child data products, ie data products that use this data product as a source for their data',
        items: asRef(DataProductIdentifier),
      },
    },
    required: ['name', 'sourceType', 'tags', 'transforms', 'updateTrigger', 'parentDataProducts', 'childDataProducts'],
    definitions: {
      Tags,
      DataProductUpdatePolicyTypeProperty,
      DataProductUpdateTriggerTypeProperty,
      DataProductDataStatusProperty,
      DataProductSourceDataStatusProperty,
      DataProductInfrastructureStatusProperty,
      SourceTypeProperty,
      DataProductTransforms,
      DataSets,
      SouceDetailsSchema,
    },
  },
  DataProductIdentifier,
);

/**
 * The schema for a data product
 */
export const DataProduct: JsonSchema = extendSchema(
  {
    id: `${__filename}/DataProduct`,
    type: JsonSchemaType.OBJECT,
    properties: {
      dataSets: asRef(DataSets),
    },
    required: ['dataSets'],
    definitions: {
      DataSets,
    },
  },
  DataProductBase,
);

export const GovernedDataProduct = extendSchema(
  {
    id: `${__filename}/GovernedDataProduct`,
    type: JsonSchemaType.OBJECT,
    properties: {
      dataSets: asRef(GovernedDataSetsDetails),
    },
    required: ['dataSets'],
    definitions: {
      GovernedDataSetsDetails,
    },
  },
  DataProductBase,
);

export const DataProductPreviewIdentifier: JsonSchema = {
  id: `${__filename}/DataProductPreviewIdentifier`,
  type: JsonSchemaType.OBJECT,
  properties: {
    previewId: {
      type: JsonSchemaType.STRING,
      description: 'The id of the data product preview',
      ...ID_VALIDATION,
    },
  },
  required: ['previewId'],
};

// Declare ids first to allow for recursive type definition
const dataSetPreviewSchemaId = `${__filename}/DataSetPreviewSchema`;
const dataSetPreviewNamedSchemaId = `${__filename}/DataSetPreviewNamedSchema`;

export const DataSetPreviewNamedSchema: JsonSchema = {
  id: dataSetPreviewNamedSchemaId,
  type: JsonSchemaType.OBJECT,
  properties: {
    name: {
      type: JsonSchemaType.STRING,
      ...NAME_VALIDATION,
    },
    container: refById(dataSetPreviewSchemaId),
  },
  required: ['name'],
};

export const DataSetPreviewSchema: JsonSchema = {
  id: dataSetPreviewSchemaId,
  type: JsonSchemaType.OBJECT,
  properties: {
    dataType: {
      type: JsonSchemaType.STRING,
      ...NAME_VALIDATION,
    },
    fields: {
      type: JsonSchemaType.ARRAY,
      items: asRef(DataSetPreviewNamedSchema),
    },
    elementType: refById(dataSetPreviewSchemaId),
  },
  required: ['dataType'],
  definitions: {
    DataSetPreviewNamedSchema,
  },
};

export const DataSetPreview: JsonSchema = {
  id: `${__filename}/DataSetPreview`,
  type: JsonSchemaType.OBJECT,
  properties: {
    schema: asRef(DataSetPreviewSchema),
    data: {
      type: JsonSchemaType.ARRAY,
      items: {
        type: JsonSchemaType.OBJECT,
      },
    },
    s3Path: {
      description: 'The path to the data for this dataset in s3 (if any)',
      type: JsonSchemaType.STRING,
    },
    s3SamplePath: {
      description: 'The path to the sample data for this dataset in s3 (if any)',
      type: JsonSchemaType.STRING,
    },
    classification: {
      description: 'The classification of the data stored for this dataset in s3 (if any)',
      type: JsonSchemaType.STRING,
    },
    metadata: {
      description: 'Any metadata that may have been discovered by the preview',
      type: JsonSchemaType.OBJECT,
    },
  },
  required: ['schema', 'data'],
  definitions: {
    DataSetPreviewSchema,
  },
};

export const DataProductPreview: JsonSchema = extendSchema(
  {
    id: `${__filename}/DataProductPreview`,
    type: JsonSchemaType.OBJECT,
    properties: {
      status: {
        type: JsonSchemaType.STRING,
        description: 'The status of the preview execution',
        enum: Object.values(StepFunctionExecutionStatus),
      },
      error: asRef(ApiError),
      initialDataSets: {
        type: JsonSchemaType.OBJECT,
        description: 'Data sets discovered from the source data, keyed by dataset id',
        additionalProperties: asRef(DataSetPreview),
      },
      transformedDataSets: {
        type: JsonSchemaType.OBJECT,
        description: 'Data set previews after transforms have been applied, keyed by dataset id',
        additionalProperties: asRef(DataSetPreview),
      },
      transformsApplied: asRef(DataProductTransforms),
      durationMilliseconds: {
        type: JsonSchemaType.NUMBER,
        description: 'The time taken to complete the preview',
      },
    },
    required: ['status'],
    definitions: {
      DataSetPreview,
      ApiError,
      DataProductTransforms,
    },
  },
  DataProductPreviewIdentifier,
);

export const ScriptSource: JsonSchema = {
  id: `${__filename}/ScriptSource`,
  type: JsonSchemaType.STRING,
  description: 'The script content, supplied when creating a script and returned when retrieving an individual script',
  ...INLINE_SCRIPT_VALIDATION,
};

/**
 * Schema for a script
 */
export const Script: JsonSchema = extendSchema(
  {
    id: `${__filename}/Script`,
    type: JsonSchemaType.OBJECT,
    properties: {
      name: {
        type: JsonSchemaType.STRING,
        description: 'Name of the script',
        ...NAME_VALIDATION,
      },
      description: {
        type: JsonSchemaType.STRING,
        description: 'Description of the script',
        ...DESCRIPTION_VALIDATION,
      },
      source: asRef(ScriptSource),
      versionId: {
        type: JsonSchemaType.STRING,
        description: 'The version of the script',
      },
      inputSchema: {
        // input schema varies depending on the script type
        description: 'input args definition',
      },
      helperText: {
        type: JsonSchemaType.STRING,
        description: 'helper text for the script definition',
      },
    },
    required: ['name'],
    definitions: {
      ScriptSource,
    },
  },
  ScriptIdentifier,
);

/**
 * Schema for table stream details
 */
export const TableStream: JsonSchema = {
  id: `${__filename}/TableStream`,
  type: JsonSchemaType.OBJECT,
  properties: {
    crossAccount: {
      type: JsonSchemaType.BOOLEAN,
      description: 'Is the target table a cross account table',
    },
    tableStreamArn: {
      type: JsonSchemaType.STRING,
      description: 'Table stream ARN',
    },
    streamEnabled: {
      description: 'Is there a data stream enabled on the table',
      type: JsonSchemaType.BOOLEAN,
    },
    streamViewType: {
      description: 'What type of stream is enabled on the table',
      type: JsonSchemaType.STRING,
    },
  },
};
