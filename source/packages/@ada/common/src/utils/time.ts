/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

/**
 * Sleep for the given number of milliseconds
 * @param ms milliseconds to sleep for
 */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
