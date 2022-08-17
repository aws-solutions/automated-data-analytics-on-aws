/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { S3Location } from '@ada/api';
import { s3PathJoin } from './s3-location-parser';

export const toGSPath = ({ bucket, key }: S3Location): string => `gs://${s3PathJoin(bucket, key)}`;
