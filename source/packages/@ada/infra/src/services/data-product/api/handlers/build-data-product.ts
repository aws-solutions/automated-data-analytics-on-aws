/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/infra-common/constructs/api/lambda-layer/code/nodejs/api-client-lambda';
import { Athena, AwsAthenaInstance, AwsLambdaInstance, AwsS3Instance } from '@ada/aws-sdk';
import {
  AthenaQueryExecutionState,
  CallingUser,
  DataProductSourceDataStatus,
  hasQueryFailed,
  isQueryExecuting,
  sleep,
} from '@ada/common';
import { Connectors } from '@ada/connectors';
import { DataProduct, DataProductPreview, DataSet, DataSetPreview } from '@ada/api-client';
import { DataProductStore } from '../../components/ddb/data-product';
import {
  ExternalTableProps,
  buildCreateExternalTableQuery,
  buildFlatDataType,
  previewSchemaToColumnMetadata,
} from '@ada/microservice-common';
import { InvocationType } from 'aws-cdk-lib/triggers';
import { LockClient } from '../../../api/components/entity/locks/client';
import { Logger } from '@ada/infra-common/constructs/lambda/lambda-logger';
import { VError } from 'verror';
import { entityIdentifier } from '@ada/api-client/types';
import { startAthenaQueryExecution } from '../../../query/components/athena-query-executor-step-function/steps/start-athena-query-execution';
import { v4 as uuid } from 'uuid';

const lambda = AwsLambdaInstance();
const athena = AwsAthenaInstance();
const s3 = AwsS3Instance({ signatureVersion: 'v4' });
const log = Logger.getLogger();

const { BUILD_DATA_PRODUCT_LAMBDA_ARN, DATA_PRODUCT_GLUE_DATABASE_NAME } = process.env;

export interface BuildDataProductInput {
  dataProduct: DataProduct;
  callingUser: CallingUser;
}

// The size of data sample to use for final schema inference
const SCHEMA_INFERENCE_PREVIEW_SAMPLE_SIZE = 100;

/**
 * Returns whether or not the given data product supports querying its raw source
 */
export const isRawSourceSupported = (dataProduct: DataProduct): boolean => {
  return Connectors.CATEGORIES.SOURCE_QUERY_ENABLED_CONNECTORS.has(dataProduct.sourceType as Connectors.ID);
}

/**
 * Start the final schema preview discovery (to be saved with the data product so it can be governed early)
 * and preparation of the raw source tables if supported.
 */
export const startBuildDataProductSchemaAndSource = async (input: BuildDataProductInput) => {
  // Invoke the lambda handler defined in this file
  await lambda
    .invoke({
      FunctionName: BUILD_DATA_PRODUCT_LAMBDA_ARN ?? '',
      Payload: JSON.stringify(input),
      InvocationType: InvocationType.EVENT,
    })
    .promise();
};

/**
 * Clean upload temp folders
 * @param dataProduct
 */
const cleanS3UploadFolder = async (dataProduct: DataProduct) => {
  const sourceDetails = dataProduct.sourceDetails as any;
  const bucket = sourceDetails?.bucket;
  const key = sourceDetails?.key;
  try {
    const currentObjects = await s3
      .listObjectsV2({ Bucket: bucket, Prefix: `${dataProduct.domainId}/${dataProduct.dataProductId}/` })
      .promise();

    const deletingObjects = currentObjects.Contents?.filter(
      (content) => !content.Key?.startsWith(key) && !content.Key?.endsWith('/'),
    ).map((content) => ({ Key: content.Key! }));

    if (deletingObjects?.length) {
      const deleteParams = {
        Bucket: bucket,
        Delete: {
          Objects: deletingObjects || [],
        },
      };
      await s3.deleteObjects(deleteParams).promise();
    }
  } catch (e: any) {
    log.error('Failed to clean upload folders: ', e);
  }
};

/**
 * Run the "final" data product preview until completion
 */
const previewDataProductUntilComplete = async (
  api: ApiClient,
  dataProduct: DataProduct,
): Promise<DataProductPreview> => {
  const { domainId, dataProductId } = dataProduct;
  const previewIdentifier = await api.postDataProductPreviewDomainDataProduct({
    domainId,
    dataProductId,
    dataProductPreviewInput: dataProduct,
    sampleSize: SCHEMA_INFERENCE_PREVIEW_SAMPLE_SIZE,
  });

  let preview;
  do {
    await sleep(1000);
    preview = await api.getDataProductPreviewDomainDataProduct({
      domainId,
      dataProductId,
      ...previewIdentifier,
    });
  } while (preview.status === 'RUNNING');

  return preview;
};

const createExternalTable = async (callingUser: CallingUser, props: ExternalTableProps): Promise<void> => {
  log.info('Creating external table for source dataSet', props);
  const createTableQuery = buildCreateExternalTableQuery(props);
  log.debug('Create external table query is', { createTableQuery });

  const execution = await startAthenaQueryExecution(callingUser, createTableQuery);
  log.info('Started query execution to create the external table', execution);

  let status: Athena.QueryExecutionStatus;
  do {
    await sleep(500);
    status = (
      await athena
        .getQueryExecution({
          QueryExecutionId: execution.QueryExecutionId!,
        })
        .promise()
    ).QueryExecution!.Status!;
  } while (isQueryExecuting(status.State! as AthenaQueryExecutionState));

  if (hasQueryFailed(status.State! as AthenaQueryExecutionState)) {
    throw new VError(
      { name: 'QueryExecutionError' },
      status.StateChangeReason || `Failed to create table ${props.tableName}`,
    );
  }
  log.info('Successfully created external table for source dataSet');
};

/**
 * Create a table for a source data set
 */
const createSourceDataSet = async (
  callingUser: CallingUser,
  dataProduct: DataProduct,
  dataSetId: string,
  dataSetPreview: DataSetPreview,
): Promise<[string, DataSet]> => {
  const { domainId, dataProductId } = dataProduct;
  const columnMetadata = previewSchemaToColumnMetadata(dataSetPreview.schema);

  const database = DATA_PRODUCT_GLUE_DATABASE_NAME ?? '';
  const tableName = `dp_source_${domainId}_${dataProductId}_${dataSetId}_${uuid()}`.replace(/-/g, '_');

  await createExternalTable(callingUser, {
    database,
    tableName,
    columns: dataSetPreview.schema.fields!.map((field) => ({
      name: field.name,
      type: buildFlatDataType(field.container!),
    })),
    classification: dataSetPreview.classification!,
    s3Path: dataSetPreview.s3Path!,
    metadata: dataSetPreview.metadata,
  });

  return [
    dataSetId,
    {
      identifiers: {
        catalog: 'AwsDataCatalog',
        database,
        table: tableName,
      },
      columnMetadata,
    },
  ];
};

/**
 * Creates the appropriate tables to allow querying of the raw source data
 */
const createSourceDataSets = async (
  callingUser: CallingUser,
  dataProduct: DataProduct,
  preview: DataProductPreview,
): Promise<Partial<Pick<DataProduct, 'sourceDataStatus' | 'sourceDataStatusDetails' | 'sourceDataSets'>>> => {
  try {
    return {
      sourceDataStatus: DataProductSourceDataStatus.READY,
      sourceDataSets: Object.fromEntries(
        await Promise.all(
          Object.entries(preview.initialDataSets!).map(([dataSetId, dataSetPreview]) =>
            createSourceDataSet(callingUser, dataProduct, dataSetId, dataSetPreview),
          ),
        ),
      ),
    };
  } catch (e: any) {
    log.warn(e);
    return {
      sourceDataStatus: DataProductSourceDataStatus.FAILED,
      sourceDataStatusDetails: e.message,
    };
  }
};

/**
 * Builds a data product's source and schema. This does not need to complete within the 30s apigateway timeout,
 * but ideally should be quick for a better ux.
 */
export const handler = async ({ callingUser, dataProduct }: BuildDataProductInput, _context: any): Promise<void> => {
  const { domainId, dataProductId } = dataProduct;
  const { userId } = callingUser;
  const lockClient = LockClient.getInstance('buildDataProduct');
  log.info('Starting data product source and schema build for data product', { domainId, dataProductId });

  try {
    const api = ApiClient.create(callingUser);
    const store = DataProductStore.getInstance();

    // Preview the data product
    const preview = await previewDataProductUntilComplete(api, dataProduct);

    // Lock the data product
    await lockClient.acquire(entityIdentifier('DataProductDomainDataProduct', { domainId, dataProductId }));
    const currentDataProduct = (await store.getDataProduct(domainId, dataProductId))!;

    if (preview.status !== 'SUCCEEDED') {
      // Preview failed, so update the data product accordingly
      log.warn('Preview failed');
      const sourceDataStatusDetails = `Preview failed with status ${preview.status} and error message ${preview.error?.message || 'unknown'
        } ${preview.error?.details || ''}`;
      await store.putDataProduct(domainId, dataProductId, userId, {
        ...currentDataProduct,
        sourceDataStatus: DataProductSourceDataStatus.FAILED,
        sourceDataStatusDetails,
      });
      log.debug(sourceDataStatusDetails);
    } else {
      // Preview succeeded
      log.info('Preview succeeded');
      let extraDataProductUpdates: Partial<DataProduct> = {};

      // Check if we support creating the reference to the raw source
      if (
        isRawSourceSupported(currentDataProduct) &&
        Object.values(preview.initialDataSets || {}).every((dataSet) => dataSet.s3Path && dataSet.classification)
      ) {
        log.info('Creating source datasets for data product', { domainId, dataProductId });
        extraDataProductUpdates = await createSourceDataSets(callingUser, currentDataProduct, preview);
      }

      // Update the data product with the final schema from the preview.
      await store.putDataProduct(domainId, dataProductId, userId, {
        ...currentDataProduct,
        ...extraDataProductUpdates,
        dataSets: Object.fromEntries(
          Object.entries(preview.transformedDataSets!).map(([dataSetId, dataSet]) => [
            dataSetId,
            {
              // NOTE: We can consider creating tables from the s3 paths for the transformed preview data sets here if
              // we want to let users get a feel for querying the data product early (but only a sample).
              identifiers: {},
              columnMetadata: previewSchemaToColumnMetadata(dataSet.schema),
            },
          ]),
        ),
      });
    }
  } finally {
    if (dataProduct?.sourceType === Connectors.Id.UPLOAD) {
      await cleanS3UploadFolder(dataProduct);
    }
    await lockClient.releaseAll();
    log.debug(`LockClient released all entities associated with ${dataProductId}`);
  }
};
