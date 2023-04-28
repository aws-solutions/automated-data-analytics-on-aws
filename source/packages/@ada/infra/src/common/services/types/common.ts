/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { APIGatewayProxyEvent } from 'aws-lambda';

export type SignedRequestEvent = Pick<APIGatewayProxyEvent, 'httpMethod' | 'headers' | 'body'>;

export interface KeyValuePair<T, Q> {
  key: T;
  value: Q;
}

export interface DataProductSecret<T> {
  key: T;
  value: T;
  secretKeyRef: T;
  secretValueRef: T;
}