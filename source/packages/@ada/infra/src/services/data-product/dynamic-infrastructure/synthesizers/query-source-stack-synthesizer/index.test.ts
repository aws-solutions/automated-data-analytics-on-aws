/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { MOCK_API_CLIENT as API, apiClientErrorResponse } from '@ada/api-client/mock';
import {
  DEFAULT_CALLER,
  DEFAULT_S3_SOURCE_DATA_PRODUCT,
  TEST_STATIC_INFRASTRUCTURE,
} from '@ada/microservice-test-common';
import { DataProduct } from '@ada/api';
import { QuerySourceStack } from '../../stacks';
import { QuerySourceStackSynthesizer } from '.';
import { SourceType } from '@ada/common';
import { StackSynthesizerProps } from '../index';
import { StatusCodes } from 'http-status-codes';

jest.mock('@ada/api-client-lambda');

jest.mock('../../stacks/query-source-stack.ts', () => ({
  ...(jest.requireActual('../../stacks/query-source-stack.ts') as any),
  QuerySourceStack: jest.fn(),
}));

const dataProduct: DataProduct = {
  ...DEFAULT_S3_SOURCE_DATA_PRODUCT,
  sourceType: SourceType.QUERY,
  sourceDetails: {
    query: 'select * from data.product',
    updateType: 'APPEND',
  } as any, // TODO: QUERY source type is deprecated for MVP - so it's type is not included in SourceDetailsSchema,
};

const mockStackSynthesizerProps: StackSynthesizerProps = {
  // @ts-ignore
  app: jest.fn(),
  // @ts-ignore
  api: API,
  stackIdentifier: 'test-stack',
  dataProduct,
  staticInfrastructure: TEST_STATIC_INFRASTRUCTURE,
  callingUser: DEFAULT_CALLER,
};

describe('query-source-stack-synthesizer', () => {
  it('should generate the query for use in the data product', async () => {
    API.postQueryGenerate.mockResolvedValue({
      query: 'select * from governed.data.product',
      dataProducts: [DEFAULT_S3_SOURCE_DATA_PRODUCT],
    });

    await new QuerySourceStackSynthesizer().synthesize(mockStackSynthesizerProps);

    expect(QuerySourceStack).toHaveBeenCalledWith(
      mockStackSynthesizerProps.app,
      mockStackSynthesizerProps.stackIdentifier,
      {
        dataProduct: mockStackSynthesizerProps.dataProduct,
        callingUser: DEFAULT_CALLER,
        staticInfrastructure: mockStackSynthesizerProps.staticInfrastructure,
        generatedQuery: 'select * from governed.data.product',
        parentDataProducts: [DEFAULT_S3_SOURCE_DATA_PRODUCT],
      },
    );
  });

  it('should throw an error if the source details are incorrect', async () => {
    await expect(
      async () =>
        await new QuerySourceStackSynthesizer().synthesize({
          ...mockStackSynthesizerProps,
          dataProduct: DEFAULT_S3_SOURCE_DATA_PRODUCT,
        }),
    ).rejects.toThrow(/source details are incorrect/);
  });

  it('should propagate the error from the generate api if it fails', async () => {
    API.postQueryGenerate.mockRejectedValue(
      apiClientErrorResponse(StatusCodes.BAD_REQUEST, { message: 'Oh no!', details: 'More details' }),
    );

    await expect(
      async () => await new QuerySourceStackSynthesizer().synthesize(mockStackSynthesizerProps),
    ).rejects.toThrow(/Oh no!.*More details/);
  });
});
