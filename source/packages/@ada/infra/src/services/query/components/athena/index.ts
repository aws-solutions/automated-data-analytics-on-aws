/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Athena, AwsAthenaInstance } from '@ada/aws-sdk';
import { DataIntegrity } from '@ada/common';
import { PaginatedQueryResult, PaginatedQueryResultAsAthena, QueryResult, QueryResultColumnMetadata } from '@ada/api';
import { PaginationParameters, fromToken, toToken } from '@ada/api-gateway';
import { QueryExecutionStepFunctionOutput } from '../step-functions';
import { getLastUpdatedDataProductDate } from '../generate-query';

type QueryResultData = QueryResult['data'][number];

const athena = AwsAthenaInstance();

export const DEFAULT_PAGE_SIZE = 1000;

export interface AthenaPaginationToken {
  nextToken: string;
  remaining?: number;
}

export const parseColumnMetadata = (metadata: Athena.ResultSetMetadata): QueryResultColumnMetadata[] => {
  return metadata.ColumnInfo!.map((q) => ({
    name: q.Name,
    type: q.Type,
    label: q.Label,
    precision: q.Precision,
    scale: q.Scale,
    nullable: q.Nullable,
    caseSensitive: q.CaseSensitive,
  }));
};

export const convertValue = (columnInfo: QueryResultColumnMetadata, value?: string) => {
  if (!value) {
    return undefined;
  }

  switch (columnInfo.type.toLocaleLowerCase()) {
    case 'boolean':
      return value.toLowerCase() === 'true';
    case 'integer':
    case 'tinyint':
    case 'smallint':
    case 'int':
    case 'bigint': // BigInt does not serialise to json, currently it is serialise into int, but might need a better solution
      return parseInt(value, 10);
    case 'double':
    case 'float':
      return parseFloat(value);
    case 'varchar':
    default:
      // NOTE: support parsing more types (eg. date, timestamp, bigint)
      // https://docs.aws.amazon.com/athena/latest/ug/data-types.html
      return value;
  }
};

/* eslint-disable sonarjs/cognitive-complexity */
export const getQueryResults = async (
  queryExecutionStepFunction: Partial<QueryExecutionStepFunctionOutput>,
  { nextToken, limit, pageSize }: PaginationParameters,
  retrieveDataIntegrity = false,
): Promise<PaginatedQueryResult> => {//NOSONAR (S3776:Cognitive Complexity) - won't fix
  const { originalQuery, callingUser, updatedTimestamp } = queryExecutionStepFunction;

  // Get the pagination details from the nextToken if specified
  let paginationDetails: AthenaPaginationToken | undefined;
  try {
    paginationDetails = fromToken<AthenaPaginationToken>(nextToken);
  } catch (e) {
    return { error: `Invalid nextToken ${nextToken}`, data: [], columns: [] };
  }

  if (!nextToken) {
    // if is the first time invoking the api, we'll ask 1 item (header) and skip the response
    const header = await athena
      .getQueryResults({
        QueryExecutionId: queryExecutionStepFunction.queryExecutionId!,
        /// the first page contains the header, so will be skipped
        MaxResults: 1,
      })
      .promise();

    paginationDetails = { nextToken: header.NextToken! };
  }

  const remainingBeforeThisPage = paginationDetails?.remaining || limit;

  const response = await athena
    .getQueryResults({
      QueryExecutionId: queryExecutionStepFunction.queryExecutionId!,
      MaxResults: Math.min(pageSize || DEFAULT_PAGE_SIZE, remainingBeforeThisPage || DEFAULT_PAGE_SIZE),
      NextToken: paginationDetails?.nextToken,
    })
    .promise();

  // Build the new next token
  let newToken: AthenaPaginationToken | undefined;
  if (response.NextToken) {
    // There are more items that can be fetched
    if (remainingBeforeThisPage) {
      // We had a limit, so check if we have reached that limit
      const remaining = remainingBeforeThisPage - response.ResultSet!.Rows!.length;
      console.log(`There are still ${remaining} items remaining`);
      if (remaining > 0) {
        // There are still more items to fetch, "remember" this in the token so we can honour the limit over multiple
        // paginated requests
        newToken = { nextToken: response.NextToken, remaining };
      }
    } else {
      // No limit was specified, so we don't set a remaining number of items to fetch
      newToken = { nextToken: response.NextToken };
    }
  }

  const metadata = parseColumnMetadata(response.ResultSet!.ResultSetMetadata!);
  let dataIntegrity;

  if (retrieveDataIntegrity) {
    const latestDataUpdateTimestamp = await getLastUpdatedDataProductDate(callingUser!, originalQuery!);

    if (latestDataUpdateTimestamp && latestDataUpdateTimestamp > updatedTimestamp!) {
      dataIntegrity = DataIntegrity.STALE;
    } else {
      dataIntegrity = DataIntegrity.CURRENT;
    }
    console.log(`dataIntegrity: ${dataIntegrity}`);
  }

  return {
    data:
      response.ResultSet?.Rows?.map((q): QueryResultData => {
        return q.Data?.reduce(
          (acc, curr, idx) => ({
            ...acc,
            [metadata[idx].name]: convertValue(metadata[idx], curr.VarCharValue),
          }),
          {},
        ) as QueryResultData;
      }) || [],
    ...(dataIntegrity ? { dataIntegrity } : {}),
    columns: metadata,
    nextToken: toToken<AthenaPaginationToken>(newToken),
  };
};
/* eslint-enable sonarjs/cognitive-complexity */

export const getQueryResultsAsAthena = async (
  queryExecutionStepFunction: Partial<QueryExecutionStepFunctionOutput>,
  maxResults?: number,
  nextToken?: string,
): Promise<PaginatedQueryResultAsAthena> => {
  const response = await athena
    .getQueryResults({
      QueryExecutionId: queryExecutionStepFunction.queryExecutionId!,
      MaxResults: maxResults,
      NextToken: nextToken,
    })
    .promise();
  return {
    nextToken: response.NextToken,
    updateCount: response.UpdateCount,
    resultSet: response.ResultSet,
  };
};
