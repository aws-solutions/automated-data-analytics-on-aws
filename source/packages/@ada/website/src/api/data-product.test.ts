/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__'
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { previewDataProductUntilComplete } from './data-product';

jest.mock('@ada/common', () => ({
	...jest.requireActual('@ada/common'),
	sleep: jest.fn(),
}))

describe('api/data-product', () => {
	describe('previewDataProductUntilComplete', () => {
		beforeEach(() => {
			jest.resetAllMocks();
		})
		it('should wait for preview to complete and return results', async () => {
			const PREVIEW_ID = 'preview-id';
			API.postDataProductPreviewDomainDataProduct.mockResolvedValue({ previewId: PREVIEW_ID });
			API.getDataProductPreviewDomainDataProduct.mockResolvedValue({ previewId: PREVIEW_ID, status: 'SUCCEEDED' });
			API.getDataProductPreviewDomainDataProduct.mockResolvedValueOnce({ previewId: PREVIEW_ID, status: 'RUNNING' });
			API.getDataProductPreviewDomainDataProduct.mockResolvedValueOnce({ previewId: PREVIEW_ID, status: 'RUNNING' });

			expect(await previewDataProductUntilComplete(fixtures.DATA_PRODUCT, false)).toEqual(expect.objectContaining({ status: 'SUCCEEDED' }));
			expect(API.getDataProductPreviewDomainDataProduct).toBeCalledTimes(3);
			expect(API.postDataProductPreviewDomainDataProduct).toBeCalledWith(expect.objectContaining({
				dataProductPreviewInput: expect.objectContaining({ enableAutomaticTransforms: false }),
			}))
		})
		it('should add enableAutomaticTransforms when auto is true', async () => {
			const PREVIEW_ID = 'preview-id';
			API.postDataProductPreviewDomainDataProduct.mockResolvedValue({ previewId: PREVIEW_ID });
			API.getDataProductPreviewDomainDataProduct.mockResolvedValue({ previewId: PREVIEW_ID, status: 'SUCCEEDED' });

			expect(await previewDataProductUntilComplete(fixtures.DATA_PRODUCT, true)).toEqual(expect.objectContaining({ status: 'SUCCEEDED' }));
			expect(API.postDataProductPreviewDomainDataProduct).toBeCalledWith(expect.objectContaining({
				dataProductPreviewInput: expect.objectContaining({ enableAutomaticTransforms: true }),
			}))
		})
	})
});
