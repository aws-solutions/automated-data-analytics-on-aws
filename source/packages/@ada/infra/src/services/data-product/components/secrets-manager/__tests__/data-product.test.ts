/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DEFAULT_GOOGLE_ANALYTICS_SOURCE_SCHEULDED_DATA_PRODUCT } from '@ada/microservice-test-common';
import { getSecretsToStore } from '../data-product';

const dataProduct = {
  ...DEFAULT_GOOGLE_ANALYTICS_SOURCE_SCHEULDED_DATA_PRODUCT,
  dataProductId: `${new Array(500).join('very-')}long-data-product-id`,
  domainId: `${new Array(500).join('very-')}long-domain`,
};
describe('data-product-secret', () => {
  it('should ensure data product secret is less than 512 characters long', async () => {
    const secret = getSecretsToStore(dataProduct);
    expect(secret[0].key.length).toBeLessThan(512);
  });
});
