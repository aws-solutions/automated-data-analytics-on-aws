/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultGroupIds, ReservedDomains } from '@ada/common';
import { DomainStore } from '../../components/ddb/domain';
import { VError } from 'verror';

const RESERVED_DOMAINS = new Set<string>(Object.values(ReservedDomains));
/**
 * Handler for creating/updating a domain
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'putDataProductDomain',
  async ({ requestParameters, body: domainToWrite }, callingUser, _event, { log }) => {
    const { domainId } = requestParameters;

    log.options.tags?.push(domainId);

    if (RESERVED_DOMAINS.has(domainId)) {
      return ApiResponse.badRequest({
        message: `Cannot create a domain with reserved domainId ${domainId}`,
      });
    }
    const store = DomainStore.getInstance();
    const domain = await store.getDomain(domainId);

    if (domain && domain.createdBy !== callingUser.userId && !callingUser.groups.includes(DefaultGroupIds.ADMIN)) {
      return ApiResponse.forbidden({
        message: `You don't have permissions to update the domain with id ${domainId}`,
      });
    }

    try {
      return ApiResponse.success(
        await store.putDomain(domainId, callingUser.userId, {
          ...domainToWrite,
          domainId,
        }),
      );
    } catch (err: any) {
      return ApiResponse.badRequest(
        new VError({ name: 'PutDomainError', cause: err }, `Error storing domain with ID ${domainId}`),
      );
    }
  },
);
