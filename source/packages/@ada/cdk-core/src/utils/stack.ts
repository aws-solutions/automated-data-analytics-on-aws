/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { Stack } from 'aws-cdk-lib';

export function getRootStack(scope: Construct): Stack {
  let rootStack = Stack.of(scope);

  while (rootStack.nestedStackParent) {
    rootStack = rootStack.nestedStackParent;
  }

  return rootStack;
}
