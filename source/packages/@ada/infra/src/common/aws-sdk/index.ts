/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { solutionInfo } from '@ada/common';
import AWSXRay from 'aws-xray-sdk-core';
import awsSdk from 'aws-sdk';

// warp with Xray
export const AWS = process.env.XRAY_DISABLED ? awsSdk : AWSXRay.captureAWS(awsSdk);

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
type SDKProps = Record<string, any>;
const { awsSolutionId, awsSolutionVersion } = solutionInfo();
const userAgent = `AwsSolution/${awsSolutionId}/${awsSolutionVersion}`;
const commonProps = { customUserAgent: userAgent };

export const AwsKMSInstance = (props?: SDKProps): AWS.KMS => new AWS.KMS({ ...props, ...commonProps });

export const AwsDynamoDB = (props?: SDKProps): AWS.DynamoDB => new AWS.DynamoDB({ ...props, ...commonProps });

export const AwsSecretsManagerInstance = (props?: SDKProps): AWS.SecretsManager =>
  new AWS.SecretsManager({ ...props, ...commonProps });

export const AwsWAFV2Instance = (props?: SDKProps): AWS.WAFV2 => new AWS.WAFV2({ ...props, ...commonProps });

export const AwsDynamoDBDocumentClient = (props?: SDKProps): AWS.DynamoDB.DocumentClient =>
  new AWS.DynamoDB.DocumentClient({ ...props, ...commonProps });

export const AwsLambdaInstance = (props?: SDKProps): AWS.Lambda => new AWS.Lambda({ ...props, ...commonProps });

export const AwsS3Instance = (props?: SDKProps): AWS.S3 => new AWS.S3({ ...props, ...commonProps });

export const AwsCloudFormationInstance = (props?: SDKProps): AWS.CloudFormation =>
  new AWS.CloudFormation({ ...props, ...commonProps });

export const AwsCostExplorerInstance = (props?: SDKProps): AWS.CostExplorer =>
  new AWS.CostExplorer({ ...props, ...commonProps });

export const AwsAPIGatewayInstance = (props?: SDKProps): AWS.APIGateway =>
  new AWS.APIGateway({ ...props, ...commonProps });

export const AwsCognitoIdentityServiceProviderInstance = (props?: SDKProps): AWS.CognitoIdentityServiceProvider =>
  new AWS.CognitoIdentityServiceProvider({ ...props, ...commonProps });

export const AwsEventBridgeInstance = (props?: SDKProps): AWS.EventBridge =>
  new AWS.EventBridge({ ...props, ...commonProps });

export const AwsAthenaInstance = (props?: SDKProps): AWS.Athena => new AWS.Athena({ ...props, ...commonProps });

export const AwsStepFunctionsInstance = (props?: SDKProps): AWS.StepFunctions =>
  new AWS.StepFunctions({ ...props, ...commonProps });

export const AwsGlueInstance = (props?: SDKProps): AWS.Glue => new AWS.Glue({ ...props, ...commonProps });

export const AwsSSMInstance = (props?: SDKProps): AWS.SSM => new AWS.SSM({ ...props, ...commonProps });

export const AwsKinesisInstance = (props?: SDKProps): AWS.Kinesis => new AWS.Kinesis({ ...props, ...commonProps });

export const AwsSTSInstance = (props?: SDKProps): AWS.STS => new AWS.STS({ ...props, ...commonProps });

export const AwsCodeBuildInstance = (props?: SDKProps): AWS.CodeBuild =>
  new AWS.CodeBuild({ ...props, ...commonProps });

export const AwsCloudWatchLogsInstance = (props?: SDKProps): AWS.CloudWatchLogs =>
  new AWS.CloudWatchLogs({ ...props, ...commonProps });

export * from 'aws-sdk';

export const DynamoDBConverterMarshall = AWS.DynamoDB.Converter.marshall;

export const ServiceCatalogAppRegistryInstance = (props?: SDKProps): AWS.ServiceCatalogAppRegistry => 
  new AWS.ServiceCatalogAppRegistry({ ...props, ...commonProps });

export { PromiseResult } from 'aws-sdk/lib/request';
