/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

export const PATTERN_CLOUDTRAIL_BUCKETNAME = /^(?<bucket>[^/]+)(?:\/(?<key>.+))?$/;

export const PATTERN_CLOUDTRAIL_ARN = /^arn:aws:cloudtrail:[\w-]+:\d+:trail\/[\w.-]+$/;

export const PATTERN_ROLE_ARN = /^arn:aws:iam::\d{12}:role\/([A-Za-z0-9-]+)$/;
