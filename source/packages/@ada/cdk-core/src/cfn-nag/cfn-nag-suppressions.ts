/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CfnKey, Key } from 'aws-cdk-lib/aws-kms';
import { CfnResource } from 'aws-cdk-lib';
import { IRole, ManagedPolicy, Policy } from 'aws-cdk-lib/aws-iam';

const METADATA_TYPE = 'cfn_nag';
const SUPRESSION_KEY = 'rules_to_suppress';

export interface CfnNagRuleSuppression {
  id: string;
  reason: string;
}

/**
 * Adds cfn nag suppressions to the given construct
 */
export const addCfnNagSuppressions = (construct: CfnResource, rulesToSuppress: CfnNagRuleSuppression[]): void => {
  construct.cfnOptions.metadata = {
    ...construct.cfnOptions.metadata,
    [METADATA_TYPE]: {
      ...construct.cfnOptions.metadata?.cfn_nag,
      [SUPRESSION_KEY]: [...(construct.cfnOptions.metadata?.cfn_nag?.rules_to_suppress || []), ...rulesToSuppress],
    },
  };
};

/**
 * Adds cfn nag suppressions to the default policy attached to the given role
 */
export const addCfnNagSuppressionsToRolePolicy = (role: IRole, rulesToSuppress: CfnNagRuleSuppression[]): void => {
  addCfnNagSuppressions(role.node.findChild('DefaultPolicy').node.defaultChild as CfnResource, rulesToSuppress);
};

/**
 * Adds the default lambda cfn nag rule suppressions
 */
export const addDefaultLambdaCfnNagSuppressions = (lambda: CfnResource): void => {
  addCfnNagSuppressions(lambda, [
    {
      id: 'W58',
      reason:
        'Lambda already has the required permission to write CloudWatch Logs via arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole.',
    },
    {
      id: 'W92',
      reason: 'We do not set reserved capacity to ensure we dynamically scale',
    },
    {
      id: 'W89',
      reason: 'Lambda functions not deployed in a VPC',
    },
  ]);
};

/**
 * Adds KMS Key default policy cfn nag suppressions as suggested by CDK/CFN best practices.
 * @see https://github.com/aws/aws-cdk/tree/main/packages/%40aws-cdk/aws-kms#key-policies
 * @see https://docs.aws.amazon.com/kms/latest/developerguide/key-policies.html
 */
 export const addKMSDefaultPolicyCfnNagSuppressions = (key: Key): void => {
  addCfnNagSuppressions((key.node.defaultChild as CfnKey), [
    {
      id: 'W12',
      reason: 'kms:* and account principal required to prevent cirucular dependencies and to prevent unmanageable keys - recommended https://github.com/aws/aws-cdk/tree/main/packages/%40aws-cdk/aws-kms#key-policies',
    },
  ]);
};

/**
 * Adds the default lambda service role cfn nag suppressions
 */
export const addDefaultLambdaRoleCfnNagSuppressions = (role: IRole): void => {
  addCfnNagSuppressionsToRolePolicy(role, [
    {
      id: 'W12',
      reason: '[*] Resource access is granted for xray tracing',
    },
    {
      id: 'W76',
      reason:
        'SPCM expected to be high due to complexity of project and lambda interaction with multiple dynamodb tables (eg entities, relationships, locks, etc)',
    },
  ]);
};

export const setCfnNagSuppressionForCDKPermsionBoundaryPolicy = (policy: Policy | ManagedPolicy): void => {
  const NAG_REASON_PERMISSION_BOUNDARY =
    'Policy is for CDK permissions which require this level of permissiveness - solution prevents elevation of permissions through a PermissionBoundary as per AppSec requirements.';
  addCfnNagSuppressions(policy.node.tryFindChild('Resource') as CfnResource, [
    // IAM managed policy should not allow a * resource with PassRole action
    { id: 'F40', reason: NAG_REASON_PERMISSION_BOUNDARY },
    // IAM managed policy should not allow * action
    { id: 'F5', reason: NAG_REASON_PERMISSION_BOUNDARY },
    // IAM managed policy should not allow * resource
    { id: 'W13', reason: NAG_REASON_PERMISSION_BOUNDARY },
  ]);
};
