/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ENV_TEST } from '@ada/infra-common/env';

/**
 * Generate a unique description for lambda functions with an alias to force version change
 * and prevent alias version descrepencies.
 *
 * > `A version for this Lambda function exists ( 1 ). Modify the function to create a new version.`
 *
 * @see https://github.com/aws/aws-cdk/issues/5334#issuecomment-562981777
 *
 * @param description The base lambda function description
 * @returns Description with unique stamp appended to force change
 */
export function uniqueLambdaDescription(description: string): string {
	// Ensure consistent descriptions for testing
	if (ENV_TEST) {
		return description;
	}

	return `${description} (${new Date().toISOString()})`;
}
