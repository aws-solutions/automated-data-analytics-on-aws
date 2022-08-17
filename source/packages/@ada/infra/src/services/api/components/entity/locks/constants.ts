/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
export const LOCK_PARTITION_KEY = 'entityIdentifier';

// Lock duration before auto-expire without a heartbeat (must be longer than the heartbeat)
export const LOCK_DURATION_MILLISECONDS = 5000;

// Frequency at which heartbeats are sent to retain the lock
export const LOCK_HEARTBEAT_PERIOD_MILLISECONDS = 2000;

// Number of attempts to acquire the lock. Attempts are made very "LOCK_DURATION_MILLISECONDS", so it's wise to ensure
// this does not exceed the apigateway timeout of 30s.
export const LOCK_ACQUIRE_RETRY_COUNT = 3;
