/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { APIGatewayProxyResult } from 'aws-lambda';
import { ApiError, Query } from '@ada/api';
import { AwsLambdaInstance } from '@ada/aws-sdk';
import { CallingUser } from '@ada/common';
import { StepFunctionLambdaEvent } from '@ada/microservice-common';
import { VError } from 'verror';
import { buildApiRequest } from '@ada/api-gateway';

export interface InvokeGenerateQueryEvent extends Query {
  callingUser: CallingUser;
}

export interface InvokeGenerateQueryResult extends InvokeGenerateQueryEvent {
  originalQuery: string;
}

const lambda = AwsLambdaInstance();
const { GENERATE_QUERY_FUNCTION_ARN } = process.env;

/**
 * Handler used to invoke the generate query Lambda and parse the output before sending it to the step function
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = async (
  event: StepFunctionLambdaEvent<InvokeGenerateQueryEvent>,
  _context: any,
): Promise<InvokeGenerateQueryResult> => {
  const { query, callingUser } = event.Payload;

  const result = await lambda
    .invoke({
      FunctionName: GENERATE_QUERY_FUNCTION_ARN ?? '',
      Payload: JSON.stringify(buildApiRequest(callingUser, { body: { query } })),
    })
    .promise();

  const response = JSON.parse(result.Payload as string) as APIGatewayProxyResult;
  const body: ApiError | Query = JSON.parse(response.body);

  if (response.statusCode !== 200) {
    // throw an error in case is not a 200 response, this is handled by the step function
    throw new VError({ name: (body as ApiError).name }, (body as ApiError).message);
  }

  return {
    ...event.Payload,
    // rewrite the query with the output coming from the Lambda
    query: (body as Query).query,
    originalQuery: query,
  };
};
