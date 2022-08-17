/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsKMSInstance, AwsSecretsManagerInstance } from '@ada/aws-sdk';

const secretsManager = AwsSecretsManagerInstance();
const kms = AwsKMSInstance();

const { SECRET_NAME, KEY_ID } = process.env;

const generateDataKey = (keySpec = 'AES_256') =>
  kms
    .generateDataKey({
      KeyId: KEY_ID ?? '',
      KeySpec: keySpec,
    })
    .promise();

export const handler = async (_event: any, _context: any): Promise<any> => {
  const dataKey = await generateDataKey();

  return secretsManager
    .putSecretValue({
      SecretId: SECRET_NAME ?? '',
      SecretString: dataKey.CiphertextBlob!.toString('base64'),
    })
    .promise();
};
