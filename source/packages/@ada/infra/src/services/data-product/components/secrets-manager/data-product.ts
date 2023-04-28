/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AWSError, AwsSecretsManagerInstance, PromiseResult, SecretsManager } from '@ada/aws-sdk';
import { Connectors } from '@ada/connectors';
import { DATA_PRODUCT_SECRET_PREFIX } from '../../../../common/constructs/iam/policies';
import { DataProduct } from '@ada/api';
import { DataProductSecret } from '@ada/microservice-common';
import { VError } from 'verror';
import { getFriendlyHash } from '@ada/cdk-core';
import { v4 as uuidv4 } from 'uuid';

const secretsManager = AwsSecretsManagerInstance();

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
export const requireSecret = (dataProduct: DataProduct): boolean => {
  return Connectors.getManagedSecretConfig(dataProduct.sourceType as Connectors.ID)?.enabled === true;
};

/**
 *
 * @param dataProduct the data product that has a secret
 * @returns the value of the secret to store with the prefix to use
 */
export const getSecretsToStore = (dataProduct: DataProduct): DataProductSecret<string>[] => {
  const config = Connectors.getManagedSecretConfig(dataProduct.sourceType as Connectors.ID);
  if (config?.enabled) {
    const secrets: DataProductSecret<string>[] = [];
    for (const secretDetail of config.secretDetails) {
      if (dataProduct.sourceDetails && secretDetail.secretValueProperty in dataProduct.sourceDetails) {
        secrets.push({
          key: `${DATA_PRODUCT_SECRET_PREFIX}-data-product-${getUniqueSecretKeyForDataProduct(
            dataProduct.domainId,
            dataProduct.dataProductId,
          )}`.replace(/_/g, '-'),
          value: (dataProduct.sourceDetails as any)[secretDetail.secretValueProperty],
          secretKeyRef: secretDetail.secretNameProperty,
          secretValueRef: secretDetail.secretValueProperty,
        });
      }
    }
    if (secrets.length == 0) {
      throw new VError(
        { name: 'SecretValuePropertyMissingError' },
        `The provided data product does not define secret values defined in the config`,
        { config },
      );
    } else {
      return secrets;
    }
  } else {
    throw new VError(
      { name: 'SecretNotRequiredError' },
      'The provided data product does not require any secret to be stored',
    );
  }
};

const getUniqueSecretKeyForDataProduct = (domainId: string, dataProductId: string): string => {
  return `${getFriendlyHash(domainId)}${getFriendlyHash(dataProductId)}${uuidv4()}`.replace(/_/g, '-');
};
/**
 * Update the data product to include secret name in the respective property based on the source type
 * @param secretName the name of the secret being written
 * @param secretConfig a defined secret configuration
 * @param dataProduct the data product
 * @returns updated data product
 */
export const updateDataProductSecretDetails = (
  secretName: string,
  secretConfig: DataProductSecret<string>,
  dataProduct: DataProduct,
): DataProduct => {
  const config = Connectors.getManagedSecretConfig(dataProduct.sourceType as Connectors.ID);
  if (config?.enabled && config.secretDetails && dataProduct.sourceDetails) {
    for (const secret of config.secretDetails) {
      if (
        secret.secretValueProperty == secretConfig.secretValueRef &&
        secret.secretNameProperty == secretConfig.secretKeyRef
      ) {
        delete (dataProduct.sourceDetails as any)[secret.secretValueProperty];

        (dataProduct.sourceDetails as any)[secret.secretNameProperty] = secretName;
      }
    }
  }
  return dataProduct;
};

/**
 * Get the property in which the data product secret is stored (if any)
 */
export const getSourceDetailsSecretProperty = <T extends DataProduct>(dataProduct: T): (keyof T['sourceDetails'])[] => {
  const config = Connectors.getManagedSecretConfig(dataProduct.sourceType as Connectors.ID);
  const secrets: (keyof T['sourceDetails'])[] = [];

  if (config?.enabled && config.secretDetails && dataProduct.sourceDetails) {
    for (const secret of config.secretDetails) {
      if (secret.secretNameProperty in (dataProduct.sourceDetails as any)) {
        secrets.push((dataProduct.sourceDetails as any)[secret.secretNameProperty] as keyof T['sourceDetails']);
      }
    }
  }
  return secrets;
};
