/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CfnFunction, Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { CfnResource, IAspect } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';
import { StateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { addDefaultLambdaCfnNagSuppressions, addDefaultLambdaRoleCfnNagSuppressions } from './cfn-nag-suppressions';

/**
 * Adds cfn nag warning suppressions to the construct tree
 */
export class CfnNagSuppressionAspect implements IAspect {
  public visit(node: IConstruct): void {
    if (
      (node instanceof LambdaFunction || node instanceof StateMachine) &&
      node.role &&
      node.role.node.tryFindChild('DefaultPolicy')
    ) {
      // Apply the default lambda role suppressions to lambda function or state machine roles
      addDefaultLambdaRoleCfnNagSuppressions(node.role);
    } else if (node instanceof CfnFunction) {
      // Apply the default lambda suppressions to lambdas
      addDefaultLambdaCfnNagSuppressions(node);
    } else if (node.node.path.endsWith('/Custom::S3AutoDeleteObjectsCustomResourceProvider/Handler')) {
      // Enabling auto delete objects on an s3 bucket creates a lambda, which is created via CfnResource and so is not
      // covered by the above
      addDefaultLambdaCfnNagSuppressions(node as CfnResource);
    }
  }
}
