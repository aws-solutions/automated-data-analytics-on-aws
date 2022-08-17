/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Logger } from '../lambda-logger';

describe('lambda-logger', () => {
  it('should create a logger', () => {
    const logger = Logger.getLogger({
      tags: ['foo'],
      meta: {
        prop1: 'test',
        prop2: 123,
        prop3: true,
        awsRegion: 'us-west-2',
        application: 'Testing',
      },
      lambda: {
        context: {
          awsRequestId: '79104EXAMPLEB723',
          invokedFunctionArn: 'arn:aws:lambda:us-west-2:123456789012:function:my-function',
        },
      },
    });
    expect(JSON.parse(logger.info('test').toJSON())).toEqual({
      _logLevel: 'info',
      prop1: 'test',
      prop2: 123,
      prop3: true,
      awsRegion: 'us-west-2',
      _tags: ['foo', '79104EXAMPLEB723', 'arn:aws:lambda:us-west-2:123456789012:function:my-function'],
      application: 'Testing',
      msg: 'test',
      awsRequestId: '79104EXAMPLEB723',
      invokedFunctionArn: 'arn:aws:lambda:us-west-2:123456789012:function:my-function',
    });
  });
});
