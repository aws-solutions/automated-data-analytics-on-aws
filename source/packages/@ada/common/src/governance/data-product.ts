/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

/**
 * Defines the different group access permissions for a data product policy
 */
export enum DataProductAccess {
  // Able to query the data product
  READ_ONLY = 'READ_ONLY',
  // Able to query and transform the data product, and also edit the data product (ontology mapping, permissions, etc)
  FULL = 'FULL',
}
