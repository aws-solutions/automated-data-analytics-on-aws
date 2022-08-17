/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CrawledTableDetail, StepFunctionLambdaEvent } from '@ada/microservice-common';
import { LensIds } from '@ada/common';

export interface GeneratePiiQueryResult {
  piiQuery: string[];
}

export interface GeneratePiiQueryEvent {
  readonly tableDetails: CrawledTableDetail[];
  readonly databaseName: string;
  readonly athenaUtilitiesLambdaName: string;
}

/**
 * Generate a query that calls the pii detection function on each column of the table
 * @param event initial payload of step function execution
 * @param context lambda context
 */
export const handler = async (
  event: StepFunctionLambdaEvent<GeneratePiiQueryEvent>,
  _context: any,
): Promise<GeneratePiiQueryResult> => {
  const { tableDetails, athenaUtilitiesLambdaName, databaseName } = event.Payload;
  // map over tableDetails
  const piiQuery: string[] = tableDetails.map((table) => {
    const filteredColumns = table.columns.filter((column) => column.type === 'string');

    if (!filteredColumns || filteredColumns.length === 0) {
      // error will be handled by step functions
      return '';
    }

    const columnNames: string[] = filteredColumns.map(({ name }) => name);

    return buildQuery(athenaUtilitiesLambdaName, LensIds.REDACT_PII, databaseName, table.tableName, columnNames, 100);
  });

  return {
    piiQuery,
  };
};

/**
 * Generates a query that detects pii entities on all columns that are in VARCHAR format
 * @param athenaUtilitiesLambdaName name of lambda that detects pii entities
 * @param athenaUtilitiesFunctionName name of lambda's function that detects pii entities
 * @param databaseName database name
 * @param tableName table name
 * @param columns table columns
 * @param limitNum limit number of rows
 * @returns
 */
function buildQuery(
  athenaUtilitiesLambdaName: string,
  athenaUtilitiesFunctionName: string,
  databaseName: string,
  tableName: string,
  columns: string[],
  limitNum: number,
) {
  const externalFunc = `USING EXTERNAL FUNCTION ${athenaUtilitiesFunctionName}(col1 VARCHAR, lang VARCHAR) RETURNS VARCHAR LAMBDA '${athenaUtilitiesLambdaName}'`;
  const columnList = columns
    .map((column) => ` ${athenaUtilitiesFunctionName}("${column}",'en') as "${column}"`)
    .join(',');
  const select = ` SELECT${columnList}`;

  const from = ` FROM "${databaseName}"."${tableName}" `;

  const limit = `LIMIT ${limitNum};`;

  return externalFunc + select + from + limit;
}
