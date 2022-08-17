/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsDynamoDBDocumentClient, DynamoDB } from '@ada/aws-sdk';
import { GenericDynamodbStore, fetchPageWithQueryForHashKeyEquals } from '@ada/microservice-common';
import {
  ListNotificationsResponse,
  PersistedNotification,
  PersistedNotificationEntity,
  PersistedNotificationIdentifier,
  PersistedNotificationStatusEnum,
} from '@ada/api';
import { PaginationParameters } from '@ada/api-gateway';
import { buildTargetAndStatusKey } from '../../../api/components/notification/common';

// Table names are passed as environment variables defined in the CDK infrastructure
const { NOTIFICATION_TABLE_NAME, NOTIFICATION_TARGET_AND_STATUS_INDEX_NAME } = process.env;

/**
 * Class for interacting with Notifications in dynamodb
 */
export class NotificationStore {
  // Singleton instance of the saved query store
  private static instance: NotificationStore | undefined;

  /**
   * Get an instance of the saved query store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): NotificationStore =>
    NotificationStore.instance || new NotificationStore(AwsDynamoDBDocumentClient());

  private readonly store: GenericDynamodbStore<PersistedNotificationIdentifier, PersistedNotification>;

  /**
   * Create an instance of the saved query store
   * @param ddb dynamodb document client
   */
  private constructor(ddb: DynamoDB.DocumentClient) {
    this.store = new GenericDynamodbStore<PersistedNotificationIdentifier, PersistedNotification>(
      ddb,
      NOTIFICATION_TABLE_NAME ?? '',
    );
  }

  /**
   * Get a saved query if present
   * @param notificationIdentifier the id of the saved query
   */
  public getNotification = (
    notificationIdentifier: PersistedNotificationIdentifier,
  ): Promise<PersistedNotificationEntity | undefined> => {
    return this.store.get(notificationIdentifier);
  };

  /**
   * Create or update a saved query
   * @param notificationIdentifier the id of the saved query to create/update
   * @param userId the id of the user performing the operation
   * @param notification the saved query to write
   */
  public putNotification = (
    notificationIdentifier: PersistedNotificationIdentifier,
    userId: string,
    notification: PersistedNotification,
  ): Promise<PersistedNotificationEntity> => {
    return this.store.put(notificationIdentifier, userId, notification);
  };

  /**
   * Lists notifications
   * @param target the recipient of notifications to list
   * @param status the status of notifications to list
   * @param paginationParameters options for pagination
   */
  public listNotificationsForStatus = async (
    target: string,
    status: PersistedNotificationStatusEnum,
    paginationParameters: PaginationParameters,
  ): Promise<ListNotificationsResponse & { error?: string }> => {
    const result = await this.store.list(
      paginationParameters,
      fetchPageWithQueryForHashKeyEquals('targetAndStatus', buildTargetAndStatusKey(target, status), {
        indexName: NOTIFICATION_TARGET_AND_STATUS_INDEX_NAME ?? '',
      }),
    );
    return {
      notifications: result.items,
      nextToken: result.nextToken,
      totalItems: result.totalItems,
      error: result.error,
    };
  };

  /**
   * Lists notifications
   * @param target the recipient of notifications to list
   * @param paginationParameters options for pagination
   */
  public listNotifications = async (
    target: string,
    paginationParameters: PaginationParameters,
  ): Promise<ListNotificationsResponse & { error?: string }> => {
    const result = await this.store.list(paginationParameters, fetchPageWithQueryForHashKeyEquals('target', target));
    return {
      notifications: result.items,
      nextToken: result.nextToken,
      totalItems: result.totalItems,
      error: result.error,
    };
  };

  /**
   * Lists all notifications regardless of target
   * @param paginationParameters
   */
  public listAllNotifications = async (
    paginationParameters: PaginationParameters,
  ): Promise<ListNotificationsResponse & { error?: string }> => {
    const result = await this.store.list(paginationParameters);
    return {
      notifications: result.items,
      nextToken: result.nextToken,
      totalItems: result.totalItems,
      error: result.error,
    };
  };
}
