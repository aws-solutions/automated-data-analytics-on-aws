/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductIdentifier } from '@ada/api';

export function getDataProductUrl({ domainId, dataProductId }: DataProductIdentifier): string {
  return `/data-product/${domainId}/${dataProductId}`;
}
