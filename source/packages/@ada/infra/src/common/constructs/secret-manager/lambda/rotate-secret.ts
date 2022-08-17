/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
// translated from: https://github.com/aws-samples/aws-secrets-manager-rotation-lambdas/blob/master/SecretsManagerRotationTemplate/lambda_function.py
import { AwsKMSInstance, AwsSecretsManagerInstance } from '@ada/aws-sdk';

const kms = AwsKMSInstance();
const secretsManager = AwsSecretsManagerInstance();

const { KEY_ID } = process.env;

const generateDataKey = (keySpec = 'AES_256') =>
  kms
    .generateDataKey({
      KeyId: KEY_ID ?? '',
      KeySpec: keySpec,
    })
    .promise();

export const handler = async (event: any, _context: any): Promise<any> => {
  const { SecretId: arn, ClientRequestToken: token, Step: step } = event;

  const metadata = await secretsManager.describeSecret({ SecretId: arn }).promise();
  if (!metadata.RotationEnabled) {
    throw new Error(`Secret ${arn} is not enabled for rotation`);
  }

  if (!Object.keys(metadata.VersionIdsToStages!).includes(token)) {
    throw new Error(`Secret Version ${token} has no stage for rotation of secret ${arn}`);
  } else if (metadata.VersionIdsToStages![token].includes('AWSCURRENT')) {
    return;
  } else if (!metadata.VersionIdsToStages![token].includes('AWSPENDING')) {
    throw new Error(`Secret version ${token} not set as AWSPENDING for rotation of secret ${arn}.`);
  }

  switch (step) {
    case 'createSecret':
      return createSecret(arn, token);
    case 'setSecret':
      return setSecret(arn, token);
    case 'testSecret':
      return testSecret(arn, token);
    case 'finishSecret':
      return finishSecret(arn, token);
    default:
      throw new Error('Invalid step parameter');
  }
};

const createSecret = async (arn: string, token: string) => {
  // make sure that the current secret exists
  await secretsManager
    .getSecretValue({
      SecretId: arn,
      VersionStage: 'AWSCURRENT',
    })
    .promise();

  try {
    await secretsManager
      .getSecretValue({
        SecretId: arn,
        VersionStage: 'AWSPENDING',
        VersionId: token,
      })
      .promise();

    console.log('createSecret: there is already a secret in pending state');
  } catch (e: any) {
    if (e.code === 'ResourceNotFoundException') {
      const newDataKey = await generateDataKey();
      const res = await secretsManager
        .putSecretValue({
          SecretId: arn,
          ClientRequestToken: token,
          SecretString: newDataKey.CiphertextBlob!.toString('base64'),
          VersionStages: ['AWSPENDING'],
        })
        .promise();

      console.log('createSecret: New secret version created correctly, versionId: ', res.VersionId);
    } else {
      throw e;
    }
  }
};

const setSecret = async (_arn: string, _token: string) => {
  // This is where the secret should be set in the service
  // not required as the service will always read the current version from secrets manager
  console.info('Not implemented');
};

const testSecret = async (_arn: string, _token: string) => {
  // This is where the secret should be tested against the service
  console.info('Not implemented');
};

const finishSecret = async (arn: string, token: string) => {
  const metadata = await secretsManager.describeSecret({ SecretId: arn }).promise();
  let currentVersion: string | undefined;

  Object.keys(metadata.VersionIdsToStages!).forEach((v) => {
    if (metadata.VersionIdsToStages![v].includes('AWSCURRENT')) {
      currentVersion = v;
    }
  });

  if (currentVersion === token) {
    console.log(`finishSecret: Version ${currentVersion} already marked as AWSCURRENT for ${arn}`);
    return;
  }

  await secretsManager
    .updateSecretVersionStage({
      SecretId: arn,
      VersionStage: 'AWSCURRENT',
      MoveToVersionId: token,
      RemoveFromVersionId: currentVersion!,
    })
    .promise();

  console.info(`finishSecret: Secret version ${currentVersion} updated to AWSCURRENT correctly`);
};
