/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiAccessPolicy } from '../types';
import { JsonSchema } from 'aws-cdk-lib/aws-apigateway';

describe('api/types', () => {
  it('should match api access policy resources as api arns', () => {
    const patternString = (ApiAccessPolicy.properties!.resources!.items! as JsonSchema).pattern!;
    expect(patternString).toBeDefined();
    const pattern = new RegExp(patternString);

    expect('arn:aws:execute-api:ap-southeast-2:012345678910:1pelye3ina/*/GET/*').toMatch(pattern);
    expect('arn:aws:execute-api:ap-southeast-2:012345678910:1pelye3ina/*/POST/query').toMatch(pattern);
    expect('not-an-arn').not.toMatch(pattern);
  });
});
