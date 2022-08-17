/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib';

/**
 * CDK context properties handled by the solution.
 */
export enum SolutionContext {
  /**
   * Sets the provisioned current execution count for Java runtime lambdas.
   *
   * For production it is recommend to set to greater than 0 depending on usage.
   * @default No provisioned concurrency
   * @recommended `>= 1` for production
   */
  JAVA_LAMBDA_PROVISIONED_CONCURRENT_EXECUTIONS = '@ada/lambda:java/provisionedConcurrentExecutions',

  /**
   * Overrides the default RemovalPolicy for KMS keys
   * @default DESTROY
   */
  KMS_DEFAULT_REMOVAL_POLICY = '@ada/kms:defaultRemovalPolicy',
  /**
   * Disables `CLOUDFRONT` base WAF WebACLs, which require deployment to `us-east-1` and may be
   * blocked by organization or Control Tower policies.
   */
  DISABLE_WAF_CLOUDFRONT_WEBACLS = '@ada/waf:disableCloudfrontWebACLs',
  /**
	 * Provides list of CIDR IP address ranges to apply to WAF WebACLs rules to support
	 * restricting access to an explict allow-list.
   *
   * This accept either partial [IPSet Configuration](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-wafv2-ipset.html)
   * which requires `IPAddressVersion` and `Addresses` properties, or ARN values for both CLOUDFRONT and REGIONAL existing IPSets.
	 *
	 * @example ```
	 * "@ada/waf:ipSet": {
       "IPAddressVersion": "IPV4",
       "Addresses": [
         "192.0.2.44/32",
         "192.0.0.0/16"
       ]
     }
	 * ```
	 * @example ```
	 * "@ada/waf:ipSet": {
       "CLOUDFRONT_ARN": "arn:aws:wafv2:us-east-1:<1111111111>:global/ipset/<IPSetName>/<ipset-uuid>",
       "REGIONAL_ARN": "arn:aws:wafv2:<region>:<1111111111>:regional/ipset/A<IPSetName>/<ipset-uuid>"
     }
	 * ```
	 */
  WAF_IPSET = '@ada/waf:ipSet',

  /**
   * Customize the CIDR used for VPC.
   *
   * @default '192.168.0.0/16'
   */
  VPC_CIDR = '@ada/vpc:cidr',
}

export const SOLUTION_CONTEXT_DEFAULTS: Record<SolutionContext, any> = {
  [SolutionContext.JAVA_LAMBDA_PROVISIONED_CONCURRENT_EXECUTIONS]: null,
  [SolutionContext.KMS_DEFAULT_REMOVAL_POLICY]: RemovalPolicy.DESTROY,
  [SolutionContext.DISABLE_WAF_CLOUDFRONT_WEBACLS]: false,
  [SolutionContext.WAF_IPSET]: undefined,
  [SolutionContext.VPC_CIDR]: '192.168.0.0/16', //NOSONAR (typescript:S1313:IPADDRESS)
}

export function tryGetSolutionContext(scope: Construct, context: SolutionContext): any {
  const value = scope.node.tryGetContext(context);

  if (value === undefined) {
    return SOLUTION_CONTEXT_DEFAULTS[context];
  }

  if (typeof value !== 'string') return value;

  if (/^(true|false)$/i.test(value)) {
    return value.toLowerCase() === 'true';
  }

  return value;
}
