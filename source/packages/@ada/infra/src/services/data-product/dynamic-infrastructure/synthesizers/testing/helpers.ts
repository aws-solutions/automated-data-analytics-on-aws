/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import '@ada/connectors/register-infra';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { DEFAULT_CALLER, MOCK_BASE_DATAPRODUCT, TEST_STATIC_INFRASTRUCTURE } from '@ada/microservice-test-common';
import { DataProduct } from '@ada/api';
import { SynthesizeConnectorProps, synthesizeConnectorStack } from '../index';
import { TEST_ENVIRONMENT, TestApp } from '@ada/cdk-core';
import { merge } from 'lodash';

jest.mock('@ada/api-client-lambda');

export function createMockSynthesizeConnectorProps(
  dataProduct: Pick<DataProduct, 'sourceType' | 'sourceDetails'>,
): SynthesizeConnectorProps {
  return {
    app: new TestApp(),
    // @ts-ignore
    api: API,
    stackIdentifier: 'test-stack',
    staticInfrastructure: TEST_STATIC_INFRASTRUCTURE,
    callingUser: DEFAULT_CALLER,
    dataProduct: merge({}, MOCK_BASE_DATAPRODUCT, dataProduct),
    env: TEST_ENVIRONMENT,
  };
}

export function testSynthesizeConnectorStack(dataProduct: Pick<DataProduct, 'sourceType' | 'sourceDetails'>) {
  const props = createMockSynthesizeConnectorProps(dataProduct);
  return synthesizeConnectorStack(props);
}
