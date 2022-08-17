/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { GoogleServiceAccountAuth } from '@ada/common';
import { mapKeys, repeat, snakeCase } from 'lodash';

export const GOOGLE_SERVICE_ACCOUNT: GoogleServiceAccountAuth = {
	projectId: 'mock-project',
	clientEmail: 'test@mock-project.iam.gserviceaccount.com',
	clientId: 'clientId',
	privateKeyId: 'privatekeyid',
	privateKey: `-----BEGIN PRIVATE KEY-----\n${repeat(Array.from(Array(63)).map((_v, i) => Math.round(i % 2)).join('') + '\n', 20)}-----END PRIVATE KEY-----\n`
}

export const GOOGLE_SERVICE_ACCOUNT_JSON = mapKeys(GOOGLE_SERVICE_ACCOUNT, snakeCase);
