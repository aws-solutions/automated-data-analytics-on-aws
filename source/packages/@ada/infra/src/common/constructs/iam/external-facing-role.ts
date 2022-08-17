/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CallingUser, PrincipalTagServiceValue, buildPrincipalTags } from '@ada/common';
import { CfnRole, Role, RoleProps } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface ExternalFacingRoleProps extends RoleProps {
  service: PrincipalTagServiceValue;
  callingUser?: CallingUser;
}

/**
 * Creates an iam role that may access external resources and so includes additional metadata for scoping down access
 */
export class ExternalFacingRole extends Role {
  constructor(scope: Construct, id: string, { service, callingUser, ...props }: ExternalFacingRoleProps) {
    super(scope, id, props);

    const cfnRole = this.node.defaultChild as CfnRole;

    buildPrincipalTags(service, callingUser).forEach(({ key, value }) => {
      cfnRole.tags.setTag(key, value);
    });
  }
}
