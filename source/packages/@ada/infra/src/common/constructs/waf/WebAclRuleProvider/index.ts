/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { API_WAF_ALLOW_RULE_HEADER, ApiLambdaLayer } from '../../api/lambda-layer';
import { CfnIPSet, CfnWebACL } from 'aws-cdk-lib/aws-wafv2';
import { CloudfrontIPSet } from '../cloudfront-ipset';
import { Construct } from 'constructs';
import { ENV_TEST } from '../../../env';
import { Fn, Stack } from 'aws-cdk-lib';
import { SolutionContext } from '../../../context';
import { getRootStack } from '../../../../utils/stack-utils';
import { getUniqueNameWithSolution } from '@ada/cdk-core';
import { toSdkPropertyNames } from './utils';
import { validate as validateArn } from '@aws-sdk/util-arn-parser';
import WAFV2 from 'aws-sdk/clients/wafv2';
import type { IPSet } from 'aws-sdk/clients/wafv2';

const CONTEXT_KEY = SolutionContext.WAF_IPSET;

export const WEBACL_RULEPROVIDER_ID = 'WebAclRuleProvider';

export interface SolutionWAFWebAclIPSet {
  CLOUDFRONT_ARN?: string;
  REGIONAL_ARN?: string;
  Addresses?: IPSet['Addresses'];
  IPAddressVersion?: IPSet['IPAddressVersion'];
}

type WAF_SCOPE = 'CLOUDFRONT' | 'REGIONAL';

interface ScopedRulePropertyFn {
  (wafScope: WAF_SCOPE): CfnWebACL.RuleProperty;
}

function createIpSetName(scope: Construct, wafScope: WAF_SCOPE, ipAddressVersion: IPSet['IPAddressVersion']): string {
  return getUniqueNameWithSolution(scope, `AllowList_${wafScope}_${ipAddressVersion}`, undefined, {
    includeNodeHash: false,
    separator: '_',
  });
}

/**
 * Provides systemic handling of Cloudfront scoped WebAcl Rules that includes
 * CDK context defined IPSet for allow lists that get propagated to WAF rules
 * throughout the system from a single IPSet resource.
 */
export class WebAclRuleProvider extends Construct {
  static of(scope: Construct): WebAclRuleProvider {
    return getRootStack(scope).node.findChild(WEBACL_RULEPROVIDER_ID) as WebAclRuleProvider;
  }

  static getRules(scope: Construct, wafScope: WAF_SCOPE): CfnWebACL.RuleProperty[] {
    try {
      return WebAclRuleProvider.of(scope).getRules(scope, wafScope);
    } catch (error: any) {
      if (ENV_TEST) {
        return [];
      }
      throw error;
    }
  }

  static getRulesForSdkCall(scope: Construct, wafScope: WAF_SCOPE): WAFV2.Rules {
    try {
      return WebAclRuleProvider.of(scope).getRulesForSdkCall(scope, wafScope);
    } catch (error: any) {
      if (ENV_TEST) {
        return [];
      }
      throw error;
    }
  }

  private readonly rules: (CfnWebACL.RuleProperty | ScopedRulePropertyFn)[] = [];

  private readonly cloudfrontIpSet: CloudfrontIPSet | undefined;
  private readonly cloudfrontIpSetArn: string | undefined;

  private readonly regionalIpSet: CfnIPSet | undefined;
  private readonly regionalIpSetArn: string | undefined;

  /* eslint-disable sonarjs/cognitive-complexity */
  constructor(rootStack: Stack) { //NOSONAR (S3776:Cognitive Complexity) - won't fix
    super(rootStack, WEBACL_RULEPROVIDER_ID);

    if (getRootStack(rootStack) !== rootStack) {
      throw new Error('WebAclRuleProvider must be scoped to root stack');
    }

    // add default amazon manage waf rules
    const rulesToAdd: {
      name: string;
      excludedRules: CfnWebACL.ManagedRuleGroupStatementProperty['excludedRules'];
      metricName: CfnWebACL.VisibilityConfigProperty['metricName'];
    }[] = [
      {
        name: 'AWSManagedRulesCommonRuleSet',
        excludedRules: [{ name: 'SizeRestrictions_BODY' }],
        metricName: 'awsCommonRules',
      },
      { name: 'AWSManagedRulesAmazonIpReputationList', excludedRules: [], metricName: 'awsReputation' },
      { name: 'AWSManagedRulesKnownBadInputsRuleSet', excludedRules: [], metricName: 'awsBadInput' },
    ];

    for (const rule of rulesToAdd) {
      const wafRule: CfnWebACL.RuleProperty = {
        name: `AWS-${rule.name}`,
        priority: this.rules.length,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            name: rule.name,
            vendorName: 'AWS',
            excludedRules: rule.excludedRules,
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: rule.metricName,
          sampledRequestsEnabled: true,
        },
      };

      this.rules.push(wafRule);
    }

    // Add custom rules/ipsets defined in cdk context to allow limitting access
    const contextIpSet: SolutionWAFWebAclIPSet | undefined = this.node.tryGetContext(CONTEXT_KEY);
    if (contextIpSet) {
      if (contextIpSet.Addresses && (contextIpSet.CLOUDFRONT_ARN || contextIpSet.REGIONAL_ARN)) {
        throw new Error(
          `WebAclRuleProvider context ${CONTEXT_KEY} properties "Addressess" and "CLOUDFRONT_ARN,REGIONAL_ARN" are mutually exclusive. Either provide addresses or arns.`,
        );
      }

      if (
        (contextIpSet.CLOUDFRONT_ARN || contextIpSet.REGIONAL_ARN) &&
        (!contextIpSet.CLOUDFRONT_ARN || !contextIpSet.REGIONAL_ARN)
      ) {
        throw new Error(
          `WebAclRuleProvider context ${CONTEXT_KEY} properties "CLOUDFRONT_ARN" and "REGIONAL_ARN" are mutually inclusive - you must provide both or neither.`,
        );
      }

      // Always allow internal api calls (service-to-service)
      // If WAF IPSet blocking rule is added we need to ensure internal calls
      // can still get through; for this we add "allow" rule before the IP set filter.
      this.rules.push({
        name: 'AllowInternalCalls',
        priority: this.rules.length,
        action: {
          allow: {},
        },
        statement: {
          byteMatchStatement: {
            fieldToMatch: {
              singleHeader: {
                Name: API_WAF_ALLOW_RULE_HEADER,
              },
            },
            positionalConstraint: 'EXACTLY',
            // internal api calls pass unique secret for the solution
            // secret value may contain double-quotes (") which break json parsing, so we use base64
            // the actual api call wrapping also use base64 so no need to decode in the rule
            searchString: Fn.base64(ApiLambdaLayer.of(this).secret.value),
            textTransformations: [
              {
                type: 'NONE',
                priority: 0,
              },
            ],
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: 'AllowInternalCalls',
          sampledRequestsEnabled: true,
        },
      });

      if (contextIpSet.Addresses) {
        const ipAddressVersion: IPSet['IPAddressVersion'] = contextIpSet.IPAddressVersion || 'IPV4';

        this.cloudfrontIpSet = new CloudfrontIPSet(this, 'CloudfrontIPSet', {
          name: createIpSetName(this, 'CLOUDFRONT', ipAddressVersion),
          description: 'Allowed list of IP addresses for solution',
          ipAddressVersion,
          addresses: contextIpSet.Addresses,
        });
        this.cloudfrontIpSetArn = this.cloudfrontIpSet.ipSetArn;

        this.regionalIpSet = new CfnIPSet(this, 'RegionalIPSet', {
          name: createIpSetName(this, 'REGIONAL', ipAddressVersion),
          description: 'Allowed list of IP addresses for solution',
          scope: 'REGIONAL',
          ipAddressVersion,
          addresses: contextIpSet.Addresses,
        });
        this.regionalIpSetArn = this.regionalIpSet.attrArn;
      } else {
        if (!validateArn(contextIpSet.CLOUDFRONT_ARN)) {
          throw new Error(
            `WebAclRuleProvider context ${CONTEXT_KEY}.CLOUDFRONT_ARN is not a valid arn: ${contextIpSet.CLOUDFRONT_ARN}`,
          );
        }
        if (!validateArn(contextIpSet.REGIONAL_ARN)) {
          throw new Error(
            `WebAclRuleProvider context ${CONTEXT_KEY}.REGIONAL_ARN is not a valid arn: ${contextIpSet.REGIONAL_ARN}`,
          );
        }
        this.cloudfrontIpSetArn = contextIpSet.CLOUDFRONT_ARN;
        this.regionalIpSetArn = contextIpSet.REGIONAL_ARN;
      }

      // Default for WAF is Allow, so need to have this as NotStatement
      const priority = this.rules.length;
      const ruleFn: ScopedRulePropertyFn = (scope) => ({
        name: 'BlockNonIPListAddresses',
        priority,
        action: {
          block: {},
        },
        statement: {
          // Block if NOT in ipset list of addresses
          notStatement: {
            statement: {
              ipSetReferenceStatement: {
                arn: (scope === 'CLOUDFRONT' ? this.cloudfrontIpSetArn : this.regionalIpSetArn)!,
              },
            },
          },
        },
        visibilityConfig: {
          cloudWatchMetricsEnabled: true,
          metricName: 'BlockNonIPListAddresses',
          sampledRequestsEnabled: true,
        },
      });

      this.rules.push(ruleFn);
    }
  }
  /* eslint-enable sonarjs/cognitive-complexity */

  getRules(scope: Construct, wafScope: WAF_SCOPE): CfnWebACL.RuleProperty[] {
    // ensure dependency is defined so IpSet is deployed before dependent needs its ref.
    switch (wafScope) {
      case 'CLOUDFRONT': {
        if (this.cloudfrontIpSet) {
          this.cloudfrontIpSet.bind(scope);
        }
        return this.rules.map((rule) => {
          if (typeof rule === 'function') return rule('CLOUDFRONT');
          return rule;
        });
      }
      case 'REGIONAL': {
        if (this.regionalIpSet) {
          scope.node.addDependency(this.regionalIpSet);
        }
        return this.rules.map((rule) => {
          if (typeof rule === 'function') return rule('REGIONAL');
          return rule;
        });
      }
    }
  }

  getRulesForSdkCall(scope: Construct, wafScope: WAF_SCOPE): WAFV2.Rules {
    const rules = this.getRules(scope, wafScope);
    return rules.map((rule): WAFV2.Rule => toSdkPropertyNames(rule));
  }
}
