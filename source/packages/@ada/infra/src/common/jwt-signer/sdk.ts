/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsKMSInstance, AwsSecretsManagerInstance } from '@ada/infra/src/common/aws-sdk';

export const secrets = AwsSecretsManagerInstance();

export const kms = AwsKMSInstance();
