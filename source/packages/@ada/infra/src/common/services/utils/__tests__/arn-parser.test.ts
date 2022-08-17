/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ARN, build, parse, validate } from '../arn-parser';
import { VError } from 'verror';

describe('arn-parser', () => {
  it('should validate an arn', () => {
    expect(validate('arn:aws:iam::123456789012:user/Development/product_1234/*')).toEqual(true);
    expect(validate('arn:not-an-arn')).toEqual(false);
  });

  it('should build an arn string', () => {
    expect(build({ service: 'iam', region: 'us-east-1', accountId: '123456789', resource: 'group/*' })).toBe(
      'arn:aws:iam:us-east-1:123456789:group/*',
    );

    expect(() => {
      build({ service: 'iam', region: 'us-east-1', accountId: 1234 as any, resource: 'group/*' });
    }).toThrow(VError);
  });

  it('should parse an arn', () => {
    expect(parse('arn:aws:iam::123456789012:group/*')).toStrictEqual({
      service: 'iam',
      partition: 'aws',
      region: '',
      accountId: '123456789012',
      resource: 'group/*',
    } as ARN);
  });
});
