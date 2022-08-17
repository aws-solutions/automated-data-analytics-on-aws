/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
export const timestampToDateString = (timestamp?: string) =>
  timestamp ? new Date(timestamp).toLocaleDateString() : 'N/A';
