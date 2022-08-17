/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { SourceDetailsGoogleBigQuery, SourceDetailsS3, SourceType } from '@ada/common'
import { marshallSourceDetails } from './SourceDetailsSummary'

describe('source-type/common/SourceTypeDetailsSummary', () => {
	describe('marshallSourceDetails', () => {
		it('should marshall schema definition with explicit properties', () => {
			const details: SourceDetailsS3 = {
				key: 's3-key',
				bucket: 's3-bucket',
			}
			expect(marshallSourceDetails(SourceType.S3, {
				...details,
				// fields that should be removed
				foo: 'foo',
				bar: 'bar',
			})).toStrictEqual(details);
		})
		it('should marshall schema definition with `allOf` inheritance style properties', () => {
			const details: SourceDetailsGoogleBigQuery = {
				clientEmail: 'client-email',
				clientId: 'client-id',
				privateKeyId: 'private-key-id',
				projectId: 'project-id',
				query: 'mock query',
			}
			expect(marshallSourceDetails(SourceType.GOOGLE_BIGQUERY, {
				...details,
				// fields that should be removed
				foo: 'foo',
				bar: 'bar',
			})).toStrictEqual(details);
		})
	})
})
