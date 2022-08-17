/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiError, GetCostOutput } from '@ada/api';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { AwsCostExplorerInstance, CostExplorer } from '@ada/aws-sdk';
import { VError } from 'verror';
import { camelCase, isArray, isObject, mapKeys, mapValues } from 'lodash';
import { solutionInfo } from '@ada/common';

const DEFAULT_GRANULARITY = 'DAILY';
const DEFAULT_METRICS = 'BlendedCost,UsageQuantity';

const { name: APPLICATION_TAG_VALUE } = solutionInfo();

export const validateDateFormat = (date: string | undefined, field: 'start' | 'end') => {
  const regExp = new RegExp(/^\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])$/); //NOSONAR (S6353:Concise Regex) - false positive
  if (!regExp.test(date!)) {
    throw new VError({ name: 'InvalidDateError' }, `Invalid ${field || ''} date. Should be yyyy-mm-dd`);
  }
  return date;
};

export function lowerKeys(_value: unknown, key: string): string {
  return camelCase(key);
}

// map all keys recursively and turn them into camelCase
export const mapKeysDeep = (obj: unknown, cb: any): any => {
  if (isArray(obj)) {
    return obj.map((innerObj) => mapKeysDeep(innerObj, cb));
  } else if (isObject(obj)) {
    return mapValues(mapKeys(obj, cb), (val) => mapKeysDeep(val, cb));
  } else {
    return obj;
  }
};

const ce = AwsCostExplorerInstance({ region: 'us-east-1' });
export const getCost = async (params: CostExplorer.GetCostAndUsageRequest): Promise<GetCostOutput | ApiError> => {
  try {
    const response = await ce.getCostAndUsage(params).promise();
    return mapKeysDeep(response, lowerKeys);
  } catch (e: any) {
    throw new VError({ name: 'CostError', cause: e }, `Failed to get costs.`);
  }
};

/**
 * Handler for getting costs between start and end timestamps
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('listCosts', async ({ requestParameters }, _callingUser, _event, { log }) => {
  const { startTimestamp: Start, endTimestamp: End } = requestParameters;
  log.info(`startTimestamp: ${Start}`);
  log.info(`endTimestamp: ${End}`);
  validateDateFormat(Start, 'start');
  validateDateFormat(End, 'end');
  const params = {
    Metrics: DEFAULT_METRICS.split(','),
    TimePeriod: { Start, End },
    Granularity: DEFAULT_GRANULARITY,
    GroupBy: [
      { Key: 'SERVICE', Type: 'DIMENSION' },
      { Key: 'Application', Type: 'TAG' },
    ],
    Filter: { Tags: { Key: 'Application', Values: [APPLICATION_TAG_VALUE] } },
  } as CostExplorer.GetCostAndUsageRequest;

  log.info(`Params: ${params}`);
  const response = await getCost(params);

  if (!response) {
    return ApiResponse.notFound({ message: `Unable to get costs between timestamps ${Start} and ${End}` });
  }
  return ApiResponse.success(response);
});
