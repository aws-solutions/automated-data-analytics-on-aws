/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AWSError, AwsSecretsManagerInstance, PromiseResult, SecretsManager } from '@ada/aws-sdk';
import { DataProduct, SourceTypeEnum } from '@ada/api';
import { GoogleServiceAccountAuth, SourceDetailsGoogleStorage, SourceType } from '@ada/common';
import { KeyValuePair } from '@ada/microservice-common';
import { VError } from 'verror';
import { getFriendlyHash } from '@ada/cdk-core';

const secretsManager = AwsSecretsManagerInstance();

export const DATA_PRODUCT_SECRET_PREFIX = 'DPSecrets';

/**
 * Create a new secret based on the provided input
 * @param name secret name
 * @param value secret string value
 * @returns the response of createSecret API Call
 */
export const createSecret = (
  name: string,
  value: string,
): Promise<PromiseResult<SecretsManager.CreateSecretResponse, AWSError>> =>
  secretsManager
    .createSecret({
      Name: name,
      SecretString: value,
    })
    .promise();

/**
 * Determine whether a data product requires to store secrets or not
 * @param dataProduct the data product to write/update
 * @returns true if the data product require to store a secret, false otherwise
 */
export const requireSecret = (dataProduct: DataProduct): boolean =>
  [
    SourceType.GOOGLE_STORAGE as SourceTypeEnum,
    SourceType.GOOGLE_BIGQUERY as SourceTypeEnum,
    SourceType.GOOGLE_ANALYTICS as SourceTypeEnum,
  ].includes(dataProduct.sourceType);

/**
 *
 * @param dataProduct the data product that has a secret
 * @returns the value of the secret to store with the prefix to use
 */
export const getSecretToStore = (dataProduct: DataProduct): KeyValuePair<string, string> => {
  if (requireSecret(dataProduct)) {
    return {
      key: `${DATA_PRODUCT_SECRET_PREFIX}-data-product-${getUniqueSecretKeyForDataProduct(
        dataProduct.domainId,
        dataProduct.dataProductId,
      )}`.replace(/_/g, '-'),
      value: (dataProduct.sourceDetails as SourceDetailsGoogleStorage).privateKey as string,
    };
  } else {
    throw new VError(
      { name: 'SecretNotRequiredError' },
      'The provided data product does not require any secret to be stored',
    );
  }
};

const getUniqueSecretKeyForDataProduct = (domainId: string, dataProductId: string): string => {
  return `${getFriendlyHash(domainId)}${getFriendlyHash(dataProductId)}${new Date().getTime()}`.replace(/_/g, '-');
};
/**
 * Update the data product to include secret name in the respective property based on the source type
 * @param secretName the name of the secret being written
 * @param dataProduct the data product
 * @returns updated data product
 */
export const updateDataProductSecretDetails = (secretName: string, dataProduct: DataProduct): DataProduct => {
  if (requireSecret(dataProduct)) {
    delete (dataProduct.sourceDetails as SourceDetailsGoogleStorage).privateKey;
    const secretPropertyName = getSourceDetailsSecretProperty(dataProduct);
    if (secretPropertyName) {
      (dataProduct.sourceDetails as SourceDetailsGoogleStorage)[secretPropertyName] = secretName;
    }
  }
  return dataProduct;
};

/**
 * Get the property in which the data product secret is stored (if any)
 */
export const getSourceDetailsSecretProperty = (dataProduct: DataProduct): keyof GoogleServiceAccountAuth | undefined =>
  requireSecret(dataProduct) ? 'privateKeySecretName' : undefined;
