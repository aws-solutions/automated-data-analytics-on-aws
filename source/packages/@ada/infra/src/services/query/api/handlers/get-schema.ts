/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/api-client-lambda';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AthenaQueryExecutionState, sleep } from '@ada/common';
import { AwsAthenaInstance, AwsS3Instance } from '@ada/aws-sdk';
import { QuerySchema } from '@ada/api';

import { getDefaultDataSetId } from '../../components/lambda';
import { parseS3Path } from '@ada/microservice-common';
import { parseStringTabularContent } from '../../components/s3';

const athena = AwsAthenaInstance();
const s3 = AwsS3Instance();
const { ATHENA_OUTPUT_BUCKET_NAME } = process.env;

// should get a response in 10 seconds, the describe query is fairly fast
export const MAX_REQUESTS = 10;

export const MAX_TIMEOUT_SECOND = 1;

export const calculateTimeout = () => MAX_TIMEOUT_SECOND * 1000;

const failedToRetrieveSchemaResponse = (dataProductId: string, message?: string) =>
  ApiResponse.badRequest({ message: message ?? `Failed to retrieve the schema for data product ${dataProductId}` });

/**
 * Handler for retrieving table schema given the data product id
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('getQuerySchemaDataProduct', async ({ requestParameters }, callingUser) => {
  const { domainId, dataProductId, dataSetId } = requestParameters;
  const { userId } = callingUser;

  const api = ApiClient.create(callingUser);

  const dataProductResponseBody = await api.getDataProductDomainDataProduct({ domainId, dataProductId });
  const dataSetKey = dataSetId ?? getDefaultDataSetId(Object.keys(dataProductResponseBody.dataSets));

  if (!dataSetKey) {
    return failedToRetrieveSchemaResponse(
      dataProductId,
      `Failed to retrieve the schema for data product ${dataProductId}. ${dataProductId} has multiple dataset, please specify the one you want to use`,
    );
  }

  if (!Object.keys(dataProductResponseBody.dataSets).includes(dataSetKey)) {
    return failedToRetrieveSchemaResponse(
      dataProductId,
      `Failed to retrieve the schema for data product ${dataProductId}. The provided dataSetId does not exists in ${dataProductId}`,
    );
  }

  const identifiers = dataProductResponseBody.dataSets[dataSetKey].identifiers;
  // remove quotes given that the describe query won't work if there are quotes in the table name
  const query = `DESCRIBE \`${identifiers.catalog}\`.\`${identifiers.database}\`.\`${identifiers.table}\``;
  const athenaExecution = await athena
    .startQueryExecution({
      QueryString: query,
      QueryExecutionContext: {
        Catalog: identifiers.catalog,
        Database: identifiers.database,
      },
      ResultConfiguration: {
        OutputLocation: `s3://${ATHENA_OUTPUT_BUCKET_NAME}/${userId}`,
      },
    })
    .promise();

  let completed = false;
  let athenaExecutionResult;
  let currentRequests = 0;

  do {
    athenaExecutionResult = await athena
      .getQueryExecution({
        QueryExecutionId: athenaExecution.QueryExecutionId!,
      })
      .promise();

    completed =
      athenaExecutionResult.QueryExecution!.Status!.State! === AthenaQueryExecutionState.SUCCEEDED ||
      athenaExecutionResult.QueryExecution!.Status!.State! === AthenaQueryExecutionState.FAILED ||
      athenaExecutionResult.QueryExecution!.Status!.State! === AthenaQueryExecutionState.CANCELLED;

    if (!completed) {
      await sleep(calculateTimeout());
    }
  } while (!(completed || ++currentRequests === MAX_REQUESTS));

  if (athenaExecutionResult.QueryExecution!.Status!.State! !== AthenaQueryExecutionState.SUCCEEDED) {
    return failedToRetrieveSchemaResponse(dataProductId);
  }

  // describe is a utility query that does not return values from GetQueryResults, need to read the output directly from S3
  const { bucket, key } = parseS3Path(athenaExecutionResult.QueryExecution!.ResultConfiguration!.OutputLocation!);
  const file = await s3
    .getObject({
      Bucket: bucket,
      Key: key,
    })
    .promise();

  if (!file.Body) {
    return failedToRetrieveSchemaResponse(dataProductId);
  }

  return ApiResponse.success(<QuerySchema>{
    schema: parseStringTabularContent(file.Body.toString('utf-8')),
  });
});
