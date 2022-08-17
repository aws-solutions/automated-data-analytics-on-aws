/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DomainStore } from '../../components/ddb/domain';

/**
 * Handler for getting a domain by domainId
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for('getDataProductDomain', async ({ requestParameters }) => {
  const { domainId } = requestParameters;

  const domain = await DomainStore.getInstance().getDomain(domainId);
  if (!domain) {
    return ApiResponse.notFound({ message: `Not Found: no domain was found with domainId ${domainId}` });
  }
  return ApiResponse.success(domain);
});
