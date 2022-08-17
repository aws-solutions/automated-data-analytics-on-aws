/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiError, DataProduct } from '@ada/api';
import { QuerySourceStack } from '../../stacks';
import { SourceDetailsQuery, SourceType } from '@ada/common';
import { Stack } from 'aws-cdk-lib';
import { StackSynthesizer, StackSynthesizerProps } from '../index';
import { VError } from 'verror';
import { isApiClientErrorResponse } from '@ada/api-gateway';

/**
 * Synthesizes the cdk stack for a data product with a query source
 */
export class QuerySourceStackSynthesizer implements StackSynthesizer {
  public synthesize = async ({
    app,
    api,
    stackIdentifier,
    dataProduct,
    callingUser,
    staticInfrastructure,
  }: StackSynthesizerProps): Promise<Stack> => {
    if (!('query' in dataProduct.sourceDetails!)) {
      throw new VError({ name: 'SourceDetailsError' }, `Provided source details are incorrect for ${SourceType.QUERY}`); //NOSONAR (S1874:Deprecated) - ignore
    }

    const { query } = dataProduct.sourceDetails as SourceDetailsQuery;

    // Generate the query - the query for the data product is governed with the permissions the creating user has at
    // the time of creation. Updates rerun the same governed query and so changes to governance or the schema for
    // source data products will not propagate to this data product.
    let generatedQuery: string;
    let parentDataProducts: DataProduct[];
    try {
      const result = await api.postQueryGenerate({
        query: {
          query,
        },
      });
      generatedQuery = result.query;
      parentDataProducts = result.dataProducts;
    } catch (e: any) {
      if (isApiClientErrorResponse(e)) {
        const error = (await e.json()) as ApiError;
        throw new VError({ name: 'ApiClientError' }, error.message + (error.details ? ` - ${error.details}` : ''));
      }
      throw e;
    }

    return new QuerySourceStack(app, stackIdentifier, {
      dataProduct,
      callingUser,
      staticInfrastructure,
      generatedQuery,
      parentDataProducts,
    });
  };
}
