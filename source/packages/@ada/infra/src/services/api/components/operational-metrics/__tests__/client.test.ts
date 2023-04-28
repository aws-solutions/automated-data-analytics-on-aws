/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import {
  METRICS_EVENT_TYPE,
  AWS_SOLUTION_ID,
  AWS_SOLUTION_VERSION,
  AWS_SOLUTION_DEPLOYMENT_ID,
  SEND_ANONYMOUS_DATA,
  OperationalMetricsClient,
} from '../client';

const mockSendAnonymousMetric = jest.fn();

jest.mock('@ada/infra-common/utils/metrics', () => ({
  ...(jest.requireActual('@ada/infra-common/utils/metrics') as any),
  sendAnonymousMetric: jest.fn((args) => Promise.resolve(mockSendAnonymousMetric(args))),
}));

describe('operational-metrics-client', () => {
  beforeEach(() => {
    process.env[AWS_SOLUTION_ID] = 'solutionId';
    process.env[AWS_SOLUTION_VERSION] = 'solutionVersion';
    process.env[AWS_SOLUTION_DEPLOYMENT_ID] = 'solutionDeploymentId';
    process.env[SEND_ANONYMOUS_DATA] = 'Yes';
    process.env['AWS_REGION'] = 'ap-southeast-2';

    mockSendAnonymousMetric.mockReturnValue('Succeeded');
  });

  afterEach(() => {
    mockSendAnonymousMetric.mockReset();
  });

  it('should send operational metrics', async () => {
    const client = new (OperationalMetricsClient as any)();
    await client.send({
      event: METRICS_EVENT_TYPE.DATA_PRODUCTS_CREATED,
      connector: 's3',
    });

    expect(mockSendAnonymousMetric).toHaveBeenCalledWith({
      awsSolutionId: 'solutionId',
      awsSolutionVersion: 'solutionVersion',
      anonymousDataUUID: 'solutionDeploymentId',
      timestamp: expect.any(String),
      data: {
        region: 'ap-southeast-2',
        event: METRICS_EVENT_TYPE.DATA_PRODUCTS_CREATED,
        connector: 's3',
      },
    });
  });

  it('should not send operational metrics when SEND_ANONYMOUS_DATA is No', async () => {
    process.env[SEND_ANONYMOUS_DATA] = 'No';

    const client = new (OperationalMetricsClient as any)();
    await client.send({
      event: METRICS_EVENT_TYPE.DATA_PRODUCTS_DELETED,
      connector: 's3',
    });

    expect(mockSendAnonymousMetric).not.toHaveBeenCalled();
  });

  it('should not send operational metrics when AWS_SOLUTION_ID is not provided', async () => {
    delete process.env[AWS_SOLUTION_ID];

    const client = new (OperationalMetricsClient as any)();
    await client.send({
      event: METRICS_EVENT_TYPE.DATA_PRODUCTS_DELETED,
      connector: 's3',
    });

    expect(mockSendAnonymousMetric).not.toHaveBeenCalled();
  });

  it('should not send operational metrics when AWS_SOLUTION_VERSION is not provided', async () => {
    delete process.env[AWS_SOLUTION_VERSION];

    const client = new (OperationalMetricsClient as any)();
    await client.send({
      event: METRICS_EVENT_TYPE.DATA_PRODUCTS_DELETED,
      connector: 's3',
    });

    expect(mockSendAnonymousMetric).not.toHaveBeenCalled();
  });

  it('should not send operational metrics when AWS_SOLUTION_DEPLOYMENT_ID is not provided', async () => {
    delete process.env[AWS_SOLUTION_DEPLOYMENT_ID];

    const client = new (OperationalMetricsClient as any)();
    await client.send({
      event: METRICS_EVENT_TYPE.DATA_PRODUCTS_DELETED,
      connector: 's3',
    });

    expect(mockSendAnonymousMetric).not.toHaveBeenCalled();
  });

  it('should not send operational metrics when SEND_ANONYMOUS_DATA is not provided', async () => {
    delete process.env[SEND_ANONYMOUS_DATA];

    const client = new (OperationalMetricsClient as any)();
    await client.send({
      event: METRICS_EVENT_TYPE.DATA_PRODUCTS_DELETED,
      connector: 's3',
    });

    expect(mockSendAnonymousMetric).not.toHaveBeenCalled();
  });

  it('should not send operational metrics when AWS_REGION is not provided', async () => {
    delete process.env['AWS_REGION'];

    const client = new (OperationalMetricsClient as any)();
    await client.send({
      event: METRICS_EVENT_TYPE.DATA_PRODUCTS_DELETED,
      connector: 's3',
    });

    expect(mockSendAnonymousMetric).not.toHaveBeenCalled();
  });
});
