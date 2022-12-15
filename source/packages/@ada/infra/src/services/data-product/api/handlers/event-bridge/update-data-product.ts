/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as _ from 'lodash';
import { ApiClient } from '@ada/infra-common/constructs/api/lambda-layer/code/nodejs/api-client-lambda';
import { CallingUser, DataProductDataStatus, DataSetIds, OntologyNamespace } from '@ada/common';
import {
  CrawledTableDetail,
  DataProductEventDetailTypes,
  DefaultUser,
  EventBridgeEvent,
  EventSource,
  StepFunctionErrorDetails,
  buildErrorMessageFromStepFunctionErrorDetails,
} from '@ada/microservice-common';
import { DataProduct, DataProductIdentifier } from '@ada/api';
import { DataProductStore } from '../../../components/ddb/data-product';
import { LockClient } from '../../../../api/components/entity/locks/client';
import { RelationshipClient } from '../../../../api/components/entity/relationships/client';
import { buildSource } from '../../../../api/components/notification/common';
import { entityIdentifier } from '@ada/api-client/types';
import { reconcileDataSets, relateDataProductWithOntologies } from './utils/data-set';

export interface UpdateDataProductEventBase {
  readonly callingUser: CallingUser;
  readonly dataProduct: DataProduct;
  readonly parentDataProducts?: DataProductIdentifier[];
}

export interface UpdateDataProductEventSuccess extends UpdateDataProductEventBase {
  readonly tableDetails: CrawledTableDetail[];
}

export interface UpdateDataProductEventError extends UpdateDataProductEventBase {
  readonly errorDetails: StepFunctionErrorDetails;
}

/**
 * Build the id of a data product
 * @param dataProductId
 * @param tableNameSuffix
 */
export const buildDataSetId = (dataProductId: string, tableNameSuffix: string): string => {
  let dataSetId = tableNameSuffix || '';
  if (dataSetId.startsWith(dataProductId)) {
    dataSetId = dataSetId.replace(dataProductId, '');
  }
  dataSetId = (_.trim(dataSetId, '_-') || DataSetIds.DEFAULT).toLowerCase();
  return dataSetId.replace(/\./g, '_');
};

/**
 * Update the data product added the crawled table information
 * @param event initial payload of step function execution
 * @param _context lambda context
 */
/* eslint-disable sonarjs/cognitive-complexity */
export const handler = async (
  event: EventBridgeEvent<UpdateDataProductEventSuccess | UpdateDataProductEventError>,
  _context: any,
): Promise<void> => { //NOSONAR (S3776:Cognitive Complexity) - won't fix
  const { source } = event;

  if (source !== buildSource(EventSource.DATA_PRODUCTS)) {
    console.error(`Unsupported source ${source}, skipping the event`);
    return;
  }

  const dataProductEventDetailType = event['detail-type'] as DataProductEventDetailTypes;

  if (
    ![
      DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_SUCCESS,
      DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_ERROR,
      DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_SUCCESS_NO_UPDATE
    ].includes(dataProductEventDetailType)
  ) {
    console.error(`Unsupported detail type ${event['detail-type']}, skipping the event`);

    return;
  }

  const {
    callingUser,
    dataProduct: { dataProductId, domainId },
    parentDataProducts: maybeParentDataProducts,
  } = event.detail;
  const parentDataProducts = maybeParentDataProducts || [];

  const lockClient = LockClient.getInstance('updateDataProductEvent');
  const dataProductEntity = entityIdentifier('DataProductDomainDataProduct', { domainId, dataProductId });

  try {
    // Lock the data product that we are about to update
    await lockClient.acquire(dataProductEntity);

    const dataProductStore = DataProductStore.getInstance();
    const currentDataProduct = await dataProductStore.getDataProduct(domainId, dataProductId);

    if (!currentDataProduct) {
      // cannot throw and error otherwise event bridge would retry the requests
      console.error(`Unexpected error, data product with id ${dataProductId} does not exist`);

      return;
    }

    let dataProductUpdates: Partial<DataProduct> = {};

    switch (dataProductEventDetailType) {
      case DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_SUCCESS: {
        const { tableDetails } = event.detail as UpdateDataProductEventSuccess;
        dataProductUpdates = {
          dataStatus: DataProductDataStatus.READY,
          dataSets: reconcileDataSets(
            currentDataProduct.dataSets,
            Object.fromEntries(
              tableDetails.map((table) => {
                const dataSetId = buildDataSetId(dataProductId, table.tableNameSuffix);
                return [
                  dataSetId,
                  {
                    ...currentDataProduct.dataSets[dataSetId],
                    identifiers: table.identifiers,
                    columnMetadata: Object.fromEntries(
                      table.columns.map((column, i) => [
                        column.name,
                        {
                          dataType: column.type,
                          // Glue returns columns in order, so preserve this order in the column metadata
                          sortOrder: i,
                          piiClassification: column.piiClassification ? column.piiClassification : undefined,
                          ontologyAttributeId: column.piiClassification
                            ? column.piiClassification.toLowerCase()
                            : undefined,
                          ontologyNamespace: column.piiClassification
                            ? OntologyNamespace.PII_CLASSIFICATIONS.toLowerCase()
                            : undefined,
                        },
                      ]),
                    ),
                  },
                ];
              }),
            ),
          ),
          latestDataUpdateTimestamp: new Date().toISOString(),
        };

        break;
      }
      case DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_ERROR: {
        const errorDetails = (event.detail as UpdateDataProductEventError).errorDetails;

        dataProductUpdates = {
          dataStatus: DataProductDataStatus.FAILED,
          dataStatusDetails: buildErrorMessageFromStepFunctionErrorDetails(errorDetails),
        };
        break;
      }
      case DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_SUCCESS_NO_UPDATE: {
        dataProductUpdates = {
          dataStatus: DataProductDataStatus.READY,
        };
        break;
      }
      default:
        // nothing to do, technically unreachable statement due to checks in preceeding code
        /* istanbul ignore next */
        break;
    }

    // Use system user given that the action is performed by the system
    const writtenDataProduct = await dataProductStore.putDataProduct(domainId, dataProductId, DefaultUser.SYSTEM, {
      ...currentDataProduct,
      ...dataProductUpdates,
      parentDataProducts,
    });

    // Relate the data product to the ontologies it references
    const relationshipClient = RelationshipClient.getInstance();
    await relateDataProductWithOntologies(
      callingUser,
      ApiClient.create(callingUser),
      writtenDataProduct,
      lockClient,
      relationshipClient,
    );

    // Lock the related data products (if any), and update relationships
    const parentDataProductEntities = parentDataProducts.map(({ domainId, dataProductId }) => //NOSONAR (S1117:ShadowVar) - ignore for readability
      entityIdentifier('DataProductDomainDataProduct', { domainId, dataProductId }),
    );
    const parentDataProductLocks = await lockClient.acquire(...parentDataProductEntities);
    await relationshipClient.updateRelationships(callingUser, dataProductEntity, parentDataProductEntities);
    await lockClient.release(...parentDataProductLocks);

    // NOTE: Consider removal since all relationships are stored centrally, however we'd need to implement apis for
    // retrieving relationships in order to show this in the UI, so leaving here for now.
    // Write the child relationships (if any)
    await Promise.all(
      parentDataProducts.map(async (parent) => {
        const parentDataProduct = (await dataProductStore.getDataProduct(parent.domainId, parent.dataProductId))!;
        await dataProductStore.putDataProduct(parent.domainId, parent.dataProductId, DefaultUser.SYSTEM, {
          ...parentDataProduct,
          childDataProducts: _.uniqWith(
            (parentDataProduct.childDataProducts || []).concat({ domainId, dataProductId }),
            _.isEqual,
          ),
        });
      }),
    );
  } finally {
    await lockClient.releaseAll();
  }

  // Event bridge handlers don't need to return a value
  console.log('EndUpdateDataProduct');
};
/* eslint-enable sonarjs/cognitive-complexity */
