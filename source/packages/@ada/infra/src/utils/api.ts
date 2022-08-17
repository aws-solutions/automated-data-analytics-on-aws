/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MockIntegration } from 'aws-cdk-lib/aws-apigateway';
import { StatusCodes } from 'http-status-codes/build/cjs';

/**
 * Mock integration which returns the given body as json
 * @param body the response body to return
 */
export const successMockIntegration = (body: any): MockIntegration =>
  new MockIntegration({
    integrationResponses: [
      {
        statusCode: String(StatusCodes.OK),
        responseTemplates: {
          'application/json': JSON.stringify(body),
        },
      },
    ],
    requestTemplates: {
      'application/json': JSON.stringify({ statusCode: StatusCodes.OK }),
    },
  });

/**
 * Mock integration which redirects to the given location
 * @param location the url to redirect to, ie the value of the location header
 */
export const redirectMockIntegration = (location: string): MockIntegration =>
  new MockIntegration({
    integrationResponses: [
      {
        statusCode: String(StatusCodes.SEE_OTHER),
        responseParameters: {
          'method.response.header.location': `'${location}'`,
        },
      },
    ],
    requestTemplates: {
      'application/json': JSON.stringify({ statusCode: StatusCodes.SEE_OTHER }),
    },
  });
