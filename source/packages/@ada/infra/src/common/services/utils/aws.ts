/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

/**
 * Call a paginated aws api
 * @param boundApiMethod the api method to call
 * @param parameters parameters to pass to each call to the api
 * @param resultListKey key in the response for the desired array of results
 * @param nextTokenKey key in the response for the pagination token (the cognito api is not consistent!)
 * @param nextTokenInputKey key to use for the pagination token in the request parameters
 * @param pageConsumer optional method to call per page of results
 * @param limit return if we have collected this many items or more
 */
export const paginatedRequest = async <Input>(
  boundApiMethod: (input: Input) => { promise: () => Promise<any> },
  parameters: Input,
  resultListKey: string,
  nextTokenKey: string,
  nextTokenInputKey: string = nextTokenKey,
  pageConsumer: (resultPage: any[]) => Promise<void> = async () => {
    /* this is intentional */
  },
  limit?: number,
): Promise<any[]> => {
  let token;
  const results = [];

  do {
    const response: any = await boundApiMethod({
      ...parameters,
      [nextTokenInputKey]: token,
    }).promise();
    await pageConsumer(response[resultListKey]);
    results.push(...(response[resultListKey] || []));
    if (limit && results.length >= limit) {
      return results;
    }
    token = response[nextTokenKey];
  } while (token);
  return results;
};
