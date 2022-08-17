/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { APIGatewayProxyEvent } from 'aws-lambda';
import { CallerDetailsKeys } from '@ada/common';

/**
 * Create an apigateway proxy event with useful defaults
 * @param event fields to override in the event
 */
export const apiGatewayEvent = (event: any): APIGatewayProxyEvent => ({
  body: undefined,
  httpMethod: '',
  isBase64Encoded: false,
  multiValueQueryStringParameters: undefined,
  path: '',
  pathParameters: undefined,
  queryStringParameters: undefined,
  resource: '',
  stageVariables: undefined,
  ...event,
  requestContext: {
    authorizer: {
      [CallerDetailsKeys.USER_ID]: 'test-user',
      [CallerDetailsKeys.USERNAME]: 'test-user@usr.example.com',
      [CallerDetailsKeys.GROUPS]: 'admin,analyst',
      ...((event.requestContext || {}).authorizer || {}),
    },
    ...(event.requestContext || {}),
  },
});

export const apiGatewayEventWithEmptyDefaults = (event: any): APIGatewayProxyEvent => ({
  body: undefined,
  httpMethod: '',
  isBase64Encoded: false,
  multiValueQueryStringParameters: undefined,
  path: '',
  pathParameters: undefined,
  queryStringParameters: undefined,
  resource: '',
  stageVariables: undefined,
  ...event,
});
