/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CallingUser, PrincipalTagServiceValue, buildPrincipalTags, computeUniqueHash } from '@ada/common';
import { STS } from '@ada/aws-sdk';
/**
 * Assume the given role as the calling user and service.
 * @param sts aws sts client
 * @param service the service assuming the role
 * @param roleArn the role to assume
 * @param callingUser calling user assuming the role
 */
export const assumeRoleAsCaller = async (
  sts: STS,
  service: PrincipalTagServiceValue,
  roleArn: string,
  callingUser: CallingUser,
): Promise<STS.AssumeRoleResponse> =>
  // NOTE: If modifying this, please ensure to update the corresponding python implementation in pull_data_sample.py
  // https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html
  // Role session Name Length Constraints: Minimum length of 2. Maximum length of 64. Pattern: [\w+=,.@-]*
  sts
    .assumeRole({
      RoleArn: roleArn,
      RoleSessionName: computeUniqueHash(`AssumeAsCaller-${callingUser.userId}-${Date.now()}`),
      Tags: buildPrincipalTags(service, callingUser).map(({ key, value }) => ({ Key: key, Value: value })),
    })
    .promise();
