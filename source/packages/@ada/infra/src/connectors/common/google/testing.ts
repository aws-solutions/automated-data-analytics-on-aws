/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { IGoogleServiceAccountAuth } from './definition';
import { mapKeys, repeat, snakeCase } from 'lodash';

export const MOCK_GOOGLE_SERVICE_ACCOUNT_INPUT: IGoogleServiceAccountAuth = {
	projectId: 'mock-project',
	clientEmail: 'test@mock-project.iam.gserviceaccount.com',
	clientId: 'clientId',
	privateKeyId: 'privatekeyid',
	privateKey: `-----BEGIN PRIVATE KEY-----\n${repeat(Array.from(Array(63)).map((_v, i) => Math.round(i % 2)).join('') + '\n', 20)}-----END PRIVATE KEY-----\n`,
}

export const MOCK_GOOGLE_SERVICE_ACCOUNT: IGoogleServiceAccountAuth = {
	...MOCK_GOOGLE_SERVICE_ACCOUNT_INPUT,
	privateKey: undefined,
	privateKeySecretName: 'a-secret-name',
}

export const MOCK_GOOGLE_SERVICE_ACCOUNT_JSON = mapKeys(MOCK_GOOGLE_SERVICE_ACCOUNT, snakeCase);
