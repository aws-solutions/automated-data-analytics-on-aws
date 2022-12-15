/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AmazonS3 } from '@ada/connectors'
import { marshallSourceDetails } from './SourceDetailsSummary'

describe('source-type/common/SourceTypeDetailsSummary', () => {
	describe('marshallSourceDetails', () => {
		it('should marshall source details based on connnector schema properties', () => {
			const details: AmazonS3.ISourceDetails = {
				key: 's3-key',
				bucket: 's3-bucket',
			}
			expect(marshallSourceDetails(AmazonS3.ID, {
				...details,
				// fields that should be removed
				foo: 'foo',
				bar: 'bar',
			})).toStrictEqual([
				{'label': 'S3 Bucket', 'value': 's3-bucket'},
				{'label': 'S3 Key', 'value': 's3-key'}
			]);
		})
	})
})
