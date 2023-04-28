/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { Logger } from '@ada/infra-common/constructs/lambda/lambda-logger';
import { MetricsPayload, OperationalMetricsConfig, sendAnonymousMetric } from '@ada/infra-common/utils/metrics';
import moment from 'moment';

export const SEND_ANONYMOUS_DATA = 'SEND_ANONYMOUS_DATA';
export const AWS_SOLUTION_ID = 'AWS_SOLUTION_ID';
export const AWS_SOLUTION_VERSION = 'AWS_SOLUTION_VERSION';
export const AWS_SOLUTION_DEPLOYMENT_ID = 'AWS_SOLUTION_DEPLOYMENT_ID';

export enum METRICS_EVENT_TYPE {
  DATA_PRODUCTS_CREATED = 'DATA_PRODUCT_CREATED',
  DATA_PRODUCTS_DELETED = 'DATA_PRODUCT_DELETED',
  QUERY_EXECUTED = 'QUERY_EXECUTED',
}

export interface OperationalMetricsDataType {
  event: METRICS_EVENT_TYPE;
}

export interface IOperationalMetricsClient {
  send: <DType extends OperationalMetricsDataType>(data: DType) => Promise<void>;
}

export const configOperationalMetricsClientForLambda = (lambda: LambdaFunction, config: OperationalMetricsConfig) => {
  lambda.addEnvironment(SEND_ANONYMOUS_DATA, config.sendAnonymousData);
  lambda.addEnvironment(AWS_SOLUTION_ID, config.awsSolutionId);
  lambda.addEnvironment(AWS_SOLUTION_VERSION, config.awsSolutionVersion);
  lambda.addEnvironment(AWS_SOLUTION_DEPLOYMENT_ID, config.anonymousDataUUID);
};

const logger = new Logger({ tags: ['OperationalMetricsClient'] });

/**
 * Client for sending operational metrics
 */
export class OperationalMetricsClient implements IOperationalMetricsClient {
  private static instance: OperationalMetricsClient;
  private awsSolutionId: string;
  private awsSolutionVersion: string;
  private anonymousDataUUID: string;
  private awsRegion: string;
  private sendAnonymousData: boolean;
  private toSend: boolean;

  public static getInstance = (): IOperationalMetricsClient => {
    if (!OperationalMetricsClient.instance) {
      OperationalMetricsClient.instance = new OperationalMetricsClient();
    }
    return OperationalMetricsClient.instance;
  };

  private constructor() {
    this.sendAnonymousData = process.env[SEND_ANONYMOUS_DATA] === 'Yes';
    this.awsSolutionId = process.env[AWS_SOLUTION_ID] || '';
    this.awsSolutionVersion = process.env[AWS_SOLUTION_VERSION] || '';
    this.anonymousDataUUID = process.env[AWS_SOLUTION_DEPLOYMENT_ID] || '';
    this.awsRegion = process.env['AWS_REGION'] || '';

    this.toSend =
      this.sendAnonymousData &&
      this.awsSolutionId !== '' &&
      this.awsSolutionVersion !== '' &&
      this.anonymousDataUUID !== '' &&
      this.awsRegion !== '';

    logger.debug(`OperationalMetricsClient send/not send decision: ${this.toSend}`);
  }

  /**
   * Send the given operational metrics
   */
  public async send<DType extends OperationalMetricsDataType>(data: DType) {
    if (this.toSend) {
      const metricData: MetricsPayload = {
        awsSolutionId: this.awsSolutionId,
        awsSolutionVersion: this.awsSolutionVersion,
        anonymousDataUUID: this.anonymousDataUUID,
        timestamp: moment.utc().format('YYYY-MM-DD HH:mm:ss.S'),
        data: {
          region: this.awsRegion,
          ...data,
        },
      };

      const result = await sendAnonymousMetric(metricData);

      logger.debug(`Sent operational metrics; result: ${result}`);
    }
  }
}
