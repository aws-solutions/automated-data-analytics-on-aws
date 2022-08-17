/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { AwsAthenaInstance, AwsSTSInstance } from '@ada/aws-sdk';
import { CallingUser, PrincipalTagServiceValue } from '@ada/common';
import { Query } from '@ada/api';
import { StepFunctionLambdaEvent } from '../../../../../common/services';
import { assumeRoleAsCaller } from '../../../../../common/constructs/iam/assume-role-as-caller';

export interface StartAthenaQueryExecutionEvent extends Query {
  callingUser: CallingUser;
  outputS3Path?: string;
}

export interface StartAthenaQueryExecutionResult extends StartAthenaQueryExecutionEvent {
  queryExecutionId: string;
}

const sts = AwsSTSInstance();
const { ATHENA_OUTPUT_BUCKET_NAME, ATHENA_EXECUTE_QUERY_ROLE_ARN } = process.env;

export const startAthenaQueryExecution = async (callingUser: CallingUser, query: string, outputS3Path?: string) => {
  // NOTE: Consider scoping down assume role policy to specific buckets involved in the query
  const { Credentials } = await assumeRoleAsCaller(
    sts,
    PrincipalTagServiceValue.QUERY,
    ATHENA_EXECUTE_QUERY_ROLE_ARN ?? '',
    callingUser,
  );
  const athena = AwsAthenaInstance({
    credentials: {
      accessKeyId: Credentials!.AccessKeyId,
      secretAccessKey: Credentials!.SecretAccessKey,
      sessionToken: Credentials!.SessionToken,
    },
  });
  return athena
    .startQueryExecution({
      QueryString: query,
      ResultConfiguration: {
        OutputLocation: outputS3Path || `s3://${ATHENA_OUTPUT_BUCKET_NAME}/${callingUser.userId}`,
      },
    })
    .promise();
};

/**
 * Handler for starting a new Athena query execution
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = async (
  event: StepFunctionLambdaEvent<StartAthenaQueryExecutionEvent>,
  _context: any,
): Promise<StartAthenaQueryExecutionResult> => {
  const { query, callingUser, outputS3Path } = event.Payload;

  const result = await startAthenaQueryExecution(callingUser, query, outputS3Path);

  return {
    ...event.Payload,
    queryExecutionId: result.QueryExecutionId!,
  };
};
