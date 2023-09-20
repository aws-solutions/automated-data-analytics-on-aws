/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as cdk from 'aws-cdk-lib';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';

/**
 * Policy for CDK deploy of data product dynamic infrastructure.
 *
 * There are a couple of tools for generating "least privilege" policies for cloudformation:
 *
 * - https://github.com/iann0036/aws-leastprivilege
 * - https://github.com/stelligent/cfn-leaprog
 *
 * However these have a bit of friction as they're more like ad-hoc tools that look at cloudtrail to figure out what
 * calls were made during a deployment to generate a policy for use in subsequent runs. This seems a little too perilous
 * as, for example, a deployment that succeeds will leave a different trail of calls to a deployment that fails and
 * rolls back.
 *
 * It would be possible but painful to explicitly specify all actions and resources for this role, but some actions
 * would still need the * resource in order to create new resources.
 *
 * Given that the current role may only be assumed by the appropriate lambda when called via cloudformation, we grant
 * the role all actions on all resources for a scoped down list of services utilised for dynamic infrastructure.
 */
const dynamicInfrastructureDeploymentActions = [
  's3:*',
  'cloudformation:*',
  'lambda:*',
  'glue:*',
  'ecs:*',
  'states:*',
  'logs:*',
  'kms:*',
  'iam:*',
  'cloudtrail:*',
  'cloudwatch:*',
  'events:*',
  'kinesis:*',
  'firehose:*',
];

export const DynamicInfraDeploymentPolicyStatement = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: dynamicInfrastructureDeploymentActions,
  resources: ['*'],
  conditions: {
    // Role may only be used by cloudformation for the provisioning of data product stacks
    'ForAnyValue:StringEquals': {
      'aws:CalledVia': ['cloudformation.amazonaws.com'],
    },
  },
});

/**
 * Defines the permissions boundary for dynamic infrastructure deployment.
 * Since dynamic infrastructure deployment requires iam:* permissions, we bound roles with these permissions to ensure
 * these roles cannot create other roles with escalated permissions.
 */
export const DynamicInfraDeploymentPermissionsBoundaryPolicyStatement = new PolicyStatement({
  effect: Effect.ALLOW,
  // Bound to the dynamic infrastructure deployment actions, plus all actions on other services used by the lambdas that
  // have these permissions.
  actions: [...dynamicInfrastructureDeploymentActions, 'dynamodb:*', 'ssm:*', 'logs:*'],
  resources: ['*'],
});

/**
 * Permission for preview lambda and importing cluster to read data source credentials
 */
export const DATA_PRODUCT_SECRET_PREFIX = 'DPSecrets';

export const DataProductSecretsPolicyStatement = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['secretsManager:GetSecretValue'],
  resources: [
    `arn:${cdk.Aws.PARTITION}:secretsmanager:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:secret:${DATA_PRODUCT_SECRET_PREFIX}*`,
  ],
});

/**
 * Grant access to all s3 buckets, since adding explicit grants per data product means we hit the maximum policy size
 * after approximately 20 data products.
 * Access to the bucket is therefore delegated to the resource policy.
 */
export const ExternalSourceDataS3AccessPolicyStatement = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['s3:List*', 's3:Get*', 's3:Describe*'],
  resources: ['*'],
});

/**
 * We grant access to decrypt any kms key since s3 buckets or kinesis streams may be encrypted and we don't know the kms
 * key arn (currently we do not request this as input from a user, but even if we did we would be subject to the maximum
 * policy size limit since the query role would need to be granted access to every kms key for every data product).
 * Access to the kms key is therefore delegated to the resource policy.
 */
export const ExternalSourceDataKmsAccessPolicyStatement = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['kms:Decrypt*', 'kms:Encrypt*', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*', 'kms:List*'],
  resources: ['*'],
});

/**
 * Grant access to assume roles within to access external services.
 */
export const ExternalSourceAssumeRolePolicyStatement = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['sts:AssumeRole', 'sts:TagSession'],
  resources: ['*'],
});

/**
 * Grant access to Query and Receive results from Cloudwatch logs.
 */
export const ExternalSourceDataCloudWatchAccessPolicyStatement = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['logs:StartQuery', 'logs:GetQueryResults'],
  resources: ['*'],
});

export const ExternalSourceRedshiftAccessPolicyStatement =  new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['redshift:GetClusterCredentials', 'redshift-serverless:GetCredentials'],
  resources: ['*'],
});

/**
 * Grant access to Query and Receive results of DynamoDB Table records DynamoDB Tables.
 */
export const ExternalSourceDynamoDBAccessPolicyStatement = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: [
    'dynamodb:BatchGetItem',
    'dynamodb:Describe*',
    'dynamodb:List*',
    'dynamodb:GetItem',
    'dynamodb:Query',
    'dynamodb:Scan',
    'dynamodb:PartiQLSelect',
  ],
  resources: ['*'],
});

/**
 * Grant the ability to get CloudTrail trail information.
 */
export const ExternalSourceDataCloudTrailAccessPolicyStatement = new PolicyStatement({
  effect: Effect.ALLOW,
  actions: ['cloudtrail:Get*', 's3:Get*', 's3:ListBucket', 'ec2:describeRegions'],
  resources: ['*'],
});
