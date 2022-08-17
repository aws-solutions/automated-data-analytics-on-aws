/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import AWSXRay from 'aws-xray-sdk-core';
import awsSdk from 'aws-sdk';

// warp with Xray
export const AWS = process.env.XRAY_DISABLED ? awsSdk : AWSXRay.captureAWS(awsSdk);

/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const { awsSolutionId, awsSolutionVersion } = require('./version.json');

const userAgent = `AwsSolution/${awsSolutionId}/${awsSolutionVersion}`;
const commonProps = { customUserAgent: userAgent };

// This is a special stub file that perform the same thing as source/packages/@ada/infra/src/common/aws-sdk/index.ts
// It has to be duplicate slightly in this places due to the way api-client-lambda is built into lambda layers which
// can't reference to other part of the alising in @ada/infra package

export const secrets = new AWS.SecretsManager(commonProps);

export const kms = new AWS.KMS(commonProps);
