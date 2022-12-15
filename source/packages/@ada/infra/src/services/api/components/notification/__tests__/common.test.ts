/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import {
  CrawledTableDetail,
  DataProductEventDetailTypes,
  EventBridgeEvent,
  EventSource,
} from '@ada/infra-common/services';
import { DEFAULT_CALLER, DEFAULT_S3_SOURCE_DATA_PRODUCT } from '@ada/microservice-test-common';
import { DataProduct, PersistedNotification, PersistedNotificationStatusEnum } from '@ada/api';
import { METADATA_DETAIL_KEY, buildSource, buildTargetAndStatusKey, persistedNotificationFromEvent } from '../common';
import {
  UpdateDataProductEventError,
  UpdateDataProductEventSuccess,
} from '@ada/services/data-product/api/handlers/event-bridge/update-data-product';

describe('notification-common', () => {
  const baseMockEventBridgeEvent = {
    region: '123',
    account: '123',
    version: '0',
    id: 'abc',
    time: '2021',
  };
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
  it('should persist notifications', () => {
    const event: EventBridgeEvent<any> = {
      ...baseMockEventBridgeEvent,
      source: buildSource(EventSource.DATA_PRODUCTS),
      'detail-type': DataProductEventDetailTypes.DATA_PRODUCT_IMPORT_SUCCESS,
      detail: {
        [METADATA_DETAIL_KEY]: {
          target: 'target',
        },
        callingUser: DEFAULT_CALLER,
        dataProduct: {
          domainId: DEFAULT_S3_SOURCE_DATA_PRODUCT.domainId,
          dataProductId: 'my-data-product',
        } as DataProduct,
        tableDetails: [tableDetails],
      },
    };
    expect(persistedNotificationFromEvent(event)).toStrictEqual({
      notificationId: 'abc',
      payload: {
        callingUser: { groups: ['admin', 'analyst'], userId: 'test-user', username: 'test-user@example.com' },
        dataProduct: { dataProductId: 'my-data-product', domainId: 'test-domain' },
        tableDetails: [
          {
            averageRecordSize: 123,
            classification: 'json',
            columns: [
              { name: 'col1', type: 'int' },
              { name: 'col2', type: 'string' },
            ],
            compressed: true,
            compressionType: 'none',
            identifiers: { catalog: 'AwsDataCatalog', database: 'test-database', table: 'tableName' },
            location: 's3://location',
            recordCount: 100,
            tableName: 'tableName',
            tableNameSuffix: '',
          },
        ],
      },
      source: 'data-products',
      status: 'PENDING',
      target: 'target',
      targetAndStatus: 'target.PENDING',
      type: 'DataProductImportSuccess',
    });
  });
  it('should not persist notifications if target is undefined', () => {
    const event: EventBridgeEvent<UpdateDataProductEventSuccess | UpdateDataProductEventError> = {
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
    };

    expect(persistedNotificationFromEvent(event)).toBe(undefined);
  });

  it('should build target and status keys', () => {
    const status: PersistedNotificationStatusEnum = 'PENDING';
    expect(buildTargetAndStatusKey('target', status)).toBe('target.PENDING');
  });
});
