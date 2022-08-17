/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
export const ARN_REGEX =
  /^arn:(?<partition>[^:\n]*):(?<service>[^:\n]*):(?<region>[^:\n]*):(?<accountId>[^:\n]*):(:?(?<resourceType>[^:/\n]*)[:/])?(?<resource>.*)$/i;

interface ArnParts {
  partition: string;
  service: string;
  region: string;
  accountId: string;
  resourceType: string;
  resource: string;
}

export function parseAwsArn(arn: string): Partial<ArnParts> {
  return (arn.match(ARN_REGEX) || {}).groups || {};
}

export function awsConsoleCloudFormationUrl(stackArn: string): string {
  const { region } = parseAwsArn(stackArn);

  return `https://${region}.console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/outputs?&stackId=${encodeURIComponent(
    stackArn,
  )}`;
}

export function awsConsoleS3Bucket(bucket: string): string {
  return `https://s3.console.aws.amazon.com/s3/buckets/${bucket}`;
}
