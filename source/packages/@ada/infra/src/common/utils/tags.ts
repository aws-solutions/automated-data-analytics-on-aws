/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CfnStack, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { getRootStack } from '@ada/cdk-core';
import { solutionInfo } from '@ada/common';

export enum ApplicationTagKey {
  Application = 'Application',
  ApplicationVersion = 'ApplicationVersion',
  ApplicationUUID = 'ApplicationUUID',
}

export function applyApplicationTags(scope: Construct): void {
  const solution = solutionInfo();
  // application tags
  Tags.of(scope).add(ApplicationTagKey.Application, solution.name);
  Tags.of(scope).add(ApplicationTagKey.ApplicationVersion, solution.id, {
    // only apply to stacks
    includeResourceTypes: [CfnStack.CFN_RESOURCE_TYPE_NAME],
  });

  // To support multiple deployments in same region would need to expose tag with global Hash
  // For now this adds to much code to CFN template for every resouce since needs to be resolved
  // at deploy time as well as causes dependency issues on global hash resources.
  // Tags.of(scope).add(ApplicationTagKey.ApplicationUUID, NamespaceAspect.of(scope)!.globalHash);
}

export function getApplicationTags(scope: Construct): Record<string, string> {
  return getRootStack(scope).tags.tagValues();
}

export function getApplicationTag(scope: Construct, tag: ApplicationTagKey): string {
  return getApplicationTags(scope)[tag];
}
