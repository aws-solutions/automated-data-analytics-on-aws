/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ENV_STORYBOOK, ENV_TEST } from './env';
import { duration as mommentDuration } from 'moment';

// NOTE: consider enable these polling intervals to be configured during deployment.

const duration: typeof mommentDuration = (...args) => {
	if (ENV_STORYBOOK) return mommentDuration(100, 'milliseconds');
	if (ENV_TEST) return mommentDuration(100, 'milliseconds');
	return mommentDuration(...args);
}

/**
 * Polling interval for fetching data product preview during creation.
 */
export const DATA_PRODUCT_PREVIEW = duration(2, 'second').asMilliseconds();

/**
 * Polling interval for checking data product status while processing.
 */
export const DATA_PRODUCT_STATUS = duration(5, 'second').asMilliseconds();

/**
 * Polling interval for fetching new access requests for group membership.
 */
export const ACCESS_REQUESTS = duration(30, 'second').asMilliseconds();

/**
 * Polling interval for fetching new notifications.
 */
export const NOTIFICATIONS = duration(15, 'second').asMilliseconds();

/**
 * Polling interval for fetching query status during execution.
 */
export const QUERY_STATUS = duration(1, 'second').asMilliseconds();

/**
 * Polling interval for performing indexing.
 */
export const INDEXING = duration(1, 'minute').asMilliseconds();

/**
 * Polling interval for invalidating cost explorer details.
 */
export const COST_RERESH = duration(30, 'minute').asMilliseconds();

/**
 * Polling interval for checking new group memberships
 */
export const GROUP_MEMBERSHIP = duration(30, 'second').asMilliseconds();
