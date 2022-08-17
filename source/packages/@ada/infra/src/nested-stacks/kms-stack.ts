/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { ExtendedNestedStack, addKMSDefaultPolicyCfnNagSuppressions, getRootStack, getUniqueKmsKeyAlias } from '@ada/cdk-core';
import { NestedStackProps, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { SolutionContext, tryGetSolutionContext } from '@ada/infra-common';

const STACK_ID = 'KMSStack';

export type KSMStackProps = NestedStackProps;

/**
 * Stack to manage KMS keys and avoid circulr dependencies.
 */
export class KMSStack extends ExtendedNestedStack {
  private static getInstance(scope: Construct): KMSStack {
    const rootStack = getRootStack(scope);

    const existing = rootStack.node.tryFindChild(STACK_ID);
    if (existing instanceof KMSStack) return existing;

    return new KMSStack(rootStack);
  }

  private constructor(scope: Construct) {
    super(scope, STACK_ID);
  }

  public static createKey(scope: Construct, name: string, props?: kms.KeyProps): kms.Key {
    const keyStack = KMSStack.getInstance(scope);
    const scopeStack = Stack.of(scope);
    scopeStack.addDependency(keyStack);

    const key = new kms.Key(keyStack, `Key-${name}`, {
      enableKeyRotation: true,
      alias: getUniqueKmsKeyAlias(scope, name),
      ...props,
      removalPolicy:
        props?.removalPolicy ||
        tryGetSolutionContext(scope, SolutionContext.KMS_DEFAULT_REMOVAL_POLICY) ||
        RemovalPolicy.DESTROY,
    });
    addKMSDefaultPolicyCfnNagSuppressions(key);

    if (props?.policy == null) {
      key.grant = (grantee: iam.IGrantable, ...actions: string[]) => {
        const grantOptions: iam.GrantWithResourceOptions = {
          grantee,
          actions,
          resource: key,
          resourceArns: [key.keyArn],
          resourceSelfArns: ['*'],
        };
        return iam.Grant.addToPrincipal(grantOptions)
      }
    }

    // // For the granteee stack as dependent on key stack to prevent circular dependencies.
    // // This dependency should automatically work based on code but seems the stack
    // // dependency is not defined when this function is invoked, so forcing it with this override
    // // by returning the `account` of grantee stack which is the behavior of the function
    // // when it detects dependecy of stacks.
    // // https://github.com/aws/aws-cdk/blob/9541de7c7beb61914c6883de0640d7664b2c8327/packages/%40aws-cdk/aws-kms/lib/key.ts#L196-L223
    // // @ts-ignore overwrite private property
    // key.granteeStackDependsOnKeyStack = (grantee) => {
    //   return Stack.of(grantee).account;
    // };
    // // Force `iam.Grant.addToPrincipalAndResource` rather than `iam.Grant.addToPrincipalOrResource` by spoofing
    // // the key grant to assume crossEnvironment based on grantee being from another region to prevent cirular dependency
    // // @ts-ignore overwrite private property
    // key.isGranteeFromAnotherRegion = () => true;

    return key;
  }
}

export default KMSStack;
