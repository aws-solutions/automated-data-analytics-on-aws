/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
jest.mock('@ada/infra', () => ({
	AdaStack: require('@ada/cdk-core').TestStack,
}))

describe('@ada/solution', () => {
	describe('bin', () => {
		it('should build app', async () => {
			process.env.DISABLE_CDK_BUNDLING = 'true';
			expect(() => require('./cdk-solution')).not.toThrow();
		})
	})
})
