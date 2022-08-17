/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { LambdaLog, LambdaLogOptions } from 'lambda-log';

const GLOBAL_METADATA = {
  application: 'Ada',
  awsRegion: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
  functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
  functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
  functionMemorySize: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
  environment: process.env.ENVIRONMENT,
  stage: process.env.STAGE,
  logStreamName: process.env.AWS_LAMBDA_LOG_STREAM_NAME,
  logGroupName: process.env.AWS_LAMBDA_LOG_GROUP_NAME,
  xrayTraceId: process.env._X_AMZN_TRACE_ID,
};

enum LogLevel {
  ERROR,
  WARN,
  INFO,
  DEBUG,
  TRACE,
}

type LogLevels = keyof typeof LogLevel;

const DEFAULT_LOG_LEVEL: LogLevels = 'INFO';
const IS_DEVELOPMENT: boolean = process.env.NODE_ENV === 'development';
const LOG_LEVEL: LogLevels =
  (process.env.LOG_LEVEL?.toUpperCase() as LogLevels) || (IS_DEVELOPMENT ? 'DEBUG' : DEFAULT_LOG_LEVEL);
const level: LogLevel = LogLevel[LOG_LEVEL] || LogLevel[DEFAULT_LOG_LEVEL];

interface LoggerOptions extends LambdaLogOptions {
  lambda?: {
    event?: any;
    context?: any;
  };
}

export class Logger extends LambdaLog {
  public static getLogger = (options?: LoggerOptions): Logger => {
    return new Logger(options);
  };

  constructor(options?: LoggerOptions) {
    const meta = {
      ...GLOBAL_METADATA,
      ...(options?.meta || {}),
    };
    const tags = [...(options?.tags || [])];
    if (options?.lambda) {
      const { event, context } = options.lambda;
      Object.assign(meta, {
        awsRequestId: context?.awsRequestId,
        invokedFunctionArn: context?.invokedFunctionArn,
        httpMethod: event?.requestContext?.httpMethod,
      });
      if (context?.awsRequestId) {
        tags.push(context.awsRequestId);
      }
      if (context?.invokedFunctionArn) {
        tags.push(context.invokedFunctionArn);
      }
    }

    super(
      {
        ...options,
        meta,
        tags,
        // @ts-ignore
        error: level >= LogLevel.ERROR,
        warn: level >= LogLevel.WARN,
        info: level >= LogLevel.INFO,
        debug: level >= LogLevel.DEBUG,
        // @ts-ignore
        trace: level >= LogLevel.TRACE,
      },
      // only add in custom log levels
      {
        trace: 'trace',
      },
    );
  }
}
