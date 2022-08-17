/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { CfnElement, CfnResource, NestedStack, NestedStackProps, Stack } from 'aws-cdk-lib';
import { CfnTable } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { getNestedStackDescription, solutionInfo } from '@ada/common';
import { lowerCase } from 'lodash';
import { pascalCase } from '../namespace';

function toLowerId(value: string): string {
  return lowerCase(value).replace(/ /g, '');
}

/**
 * Removes superfluous parts of default CDK naming for better resource naming.
 *
 * Example: Ada-XXXNestedStackXXXNestedStackResource-4B6Z5Y9XL4TD => Ada-XXXStack-4B6Z5Y9XL4TD
 * @param logicalId
 * @returns
 */
export function cleanLogicalId(cfnElement: CfnElement, logicalId: string): string {
  // CDK appends 8 digit hash of the node.path to end
  // const hash = logicalId.slice(-8)

  if (!(cfnElement instanceof CfnResource)) {
    return logicalId;
  }

  const isDefaultChild = cfnElement.node.scope && cfnElement.node.scope.node.defaultChild === cfnElement;

  // Use parent scope if element is a `defaultChild` of the parent
  const nodeId = isDefaultChild && cfnElement.node.scope ? cfnElement.node.scope.node.id : cfnElement.node.id;

  // https://regexr.com/6m20e
  logicalId = logicalId.replace(/(?:(\w+)NestedStack){2}Resource/g, '$1Stack'); //NOSONAR (S5852:Super-Linear Regex) - non user-controlled

  if (cfnElement.cfnResourceType) {
    const cfnResourceType = cfnElement.cfnResourceType.split('::').slice(-1)[0];

    // Remove duplicate resource type naming
    // - CommonStackStack => CommonStack
    // - MyBucketBucket => MyBucket
    logicalId = logicalId.replace(new RegExp(cfnResourceType + cfnResourceType, 'ig'), cfnResourceType);
  }

  // Force Tables and Buckets names to be consistent even when refactored in tree.
  // Moving a bucket in the tree must not recreate the table as that would result in data loss / broken application state.
  // By forcing the logicalId to be maintained we attempt to prevent some accidental deletions in code changes.
  if (isDefaultChild && (cfnElement instanceof CfnTable || cfnElement instanceof CfnBucket)) {
    return `${cfnElement.node.scope!.node.id}`;
  }

  // Lots of logicalIds contain cryptic lowercase concatination of words (getontologyattributepolicy)
  // we want this in PascalCase for readablity
  logicalId = logicalId.replace(new RegExp(toLowerId(nodeId), 'ig'), pascalCase(nodeId));

  return logicalId;
}

export class ExtendedStack extends Stack {
  protected allocateLogicalId(cfnElement: CfnElement): string {
    return cleanLogicalId(cfnElement, super.allocateLogicalId(cfnElement));
  }
}

export class ExtendedNestedStack extends NestedStack {
  constructor(scope: Construct, id: string, props?: NestedStackProps) {
    super(scope, id, props);
    this.templateOptions.description = getNestedStackDescription(solutionInfo(), id);
  }

  protected allocateLogicalId(cfnElement: CfnElement): string {
    return cleanLogicalId(cfnElement, super.allocateLogicalId(cfnElement));
  }
}
