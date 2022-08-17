/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CrawledTableDetail, StepFunctionLambdaEvent } from '@ada/microservice-common';
import { PaginationParameters } from '@ada/api-gateway';
import { AthenaQueryExecutionState as State } from '@ada/common';
import { getQueryResults } from '../../../../../../src/services/query/components/athena';

export interface QueryExecutionOutput {
  Output?: Output;
  piiDetectionSkipped?: boolean;
}

export interface Output {
  queryExecutionId: string;
  athenaStatus: AthenaStatus;
}

export interface AthenaStatus {
  QueryExecution: QueryExecution;
}

export interface QueryExecution {
  QueryExecutionId: string;
  Status: Status;
}

export interface Status {
  State: string;
  StateChangeReason: string;
}

export interface UpdatedColumns {
  name: string;
  type: string;
  piiClassification: string;
}

export interface GetPiiQueryEvent {
  readonly executePiiDetectionOutput: QueryExecutionOutput[];
  readonly tableDetails: CrawledTableDetail[];
}

/**
 * Get a paginated query result from an execution id
 * @param event initial payload of step function execution
 * @param context lambda context
 */
export const handler = async (
  event: StepFunctionLambdaEvent<GetPiiQueryEvent>,
  _context: any,
): Promise<CrawledTableDetail[]> => {
  const { executePiiDetectionOutput, tableDetails } = event.Payload;

  const paginationParameters: PaginationParameters = {
    pageSize: 100,
    limit: 100,
  };

  const piiResults = new Map();

  // loop over query executions and retrieve results by their queryExecutionId
  return Promise.all(
    executePiiDetectionOutput.map(async (result, index) => {
      const tableD = tableDetails[index];

      if (
        result.piiDetectionSkipped! ||
        result.Output!.athenaStatus.QueryExecution.Status.State === State.FAILED ||
        result.Output!.athenaStatus.QueryExecution.Status.State === State.CANCELLED
      ) {
        return tableD;
      } else {
        const queryResult = await getQueryResults(result.Output!, paginationParameters, false);
        const data = queryResult.data;
        const columnsMap = createPiiColumnMap(data);
        let updatedColumns: UpdatedColumns[] = [];

        // set the highest detected pii entity for each column
        columnsMap.forEach((map, key) => {
          if (map.size > 0) {
            piiResults.set(key, getMaxPiiType(map));
          }
        });

        // create new column metadata for each table
        // cater for when nested json has conflicting types with the same column name in parent and child
        updatedColumns = tableD.columns.map((col) => ({
          ...col,
          piiClassification: col.type === 'string' ? piiResults.get(col.name) : undefined,
        }));

        return {
          ...tableD,
          columns: updatedColumns,
        };
      }
    }),
  );
};

/**
 * Creates a map of columns and all their detected pii identities
 * @param data data returned from QueryExecutionResult
 * @returns Map<string, Map<string, number>>
 */
export function createPiiColumnMap(data: { [s: string]: string }[]): Map<string, Map<string, number>> {
  // columnsMap is a map which uses the column names as key to a map that counts the column's detected pii entities
  const columnsMap = new Map();
  data.forEach((row: { [s: string]: string }) => {
    Object.entries(row).forEach(([key, value]) => {
      let columnMap = columnsMap.get(key);

      // check if map has been created for column
      if (columnMap === undefined) {
        columnsMap.set(key, new Map<string, number>());
        columnMap = columnsMap.get(key);
      }
      // increment count of pii entity
      columnMap.set(value, columnMap.get(value) === undefined ? 1 : columnMap.get(value) + 1);
    });
  });
  return columnsMap;
}

/**
 * Get the max value and key associated with the max value from a given map
 * @param m map to extract max key and value from
 * @returns
 */
export function getMaxPiiType(m: Map<string, number>) {
  // take the 2nd highest if NONE is the max
  return [...m.entries()].reduce(
    (max, current) => (current[0] !== 'NONE' && current[1] > max[1] ? current : max),
    ['NONE', 0],
  )[0];
}
