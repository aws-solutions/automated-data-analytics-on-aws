/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Common } from '@ada/connectors';
import { getSolutionPersistenceKey } from '$config';

const STORAGE_KEY = getSolutionPersistenceKey('GoogleSessionCredentialsProvider', true);

export function getPersistentGoogleServiceAccountDetails (): Common.Google.IGoogleServiceAccountAuth | null {
	const value = sessionStorage.getItem(STORAGE_KEY)
	return value && JSON.parse(value) || null;
}

export function setPersistentGoogleServiceAccountDetails (details: Common.Google.IGoogleServiceAccountAuth): void {
	sessionStorage.setItem(STORAGE_KEY, JSON.stringify(details))
}
