/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { GoogleServiceAccountAuth } from '@ada/common';
import { getSolutionPersistenceKey } from '$config';

const STORAGE_KEY = getSolutionPersistenceKey('GoogleSessionCredentialsProvider', true);

export function getPersistentGoogleServiceAccountDetails (): GoogleServiceAccountAuth | null {
	const value = sessionStorage.getItem(STORAGE_KEY)
	return value && JSON.parse(value) || null;
}

export function setPersistentGoogleServiceAccountDetails (details: GoogleServiceAccountAuth): void {
	sessionStorage.setItem(STORAGE_KEY, JSON.stringify(details))
}
