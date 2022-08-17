/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Aspects, CfnDeletionPolicy, CfnOutput, CfnResource, IAspect, Lazy, Stack } from 'aws-cdk-lib';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { CfnLogStream } from 'aws-cdk-lib/aws-logs';
import { Construct, IConstruct } from 'constructs';
import { getRootStack } from '../utils';

const RETAINED_BASENAME = 'RetainedResources';

export const RETAINED_RESOURCES_EXPORT = RETAINED_BASENAME;

export const RETAINED_RESOURCES_ENV_VAR = `RETAINED_RESOURCES` as const;

export const RETAINED_COUNT_EXCEEDING_MESSAGE =
  'Exceeded export limit of 1024, view the {StackName}-AdministrationServiceStack parameter for list of retained resources.';

export const RETAINED_POLICY_ACTIONS = [
  'kms:DisableKey',
  'kms:ScheduleKeyDeletion',
  'kms:DeleteAlias',
  's3:Get*',
  's3:Describe*',
  's3:List*',
  's3:Delete*',
  'logs:Delete*',
];

/**
 * Outputs all "retained" resources within scope as output to the scope.
 */
export class RetainedAspect implements IAspect {
  static of(scope: Construct): RetainedAspect {
    const aspect = Aspects.of(getRootStack(scope)).all.find((_aspect) => _aspect instanceof RetainedAspect);
    if (aspect == null) throw new Error('RetainedAspect is not defined on root stack');
    return aspect as RetainedAspect;
  }

  private stack: Stack;

  // List of arns for all "retain" resources in scope of stack.
  private _retainedResourceArns: string[] = [];

  private _retainedResourcesForPolicy: string[] = [];

  private _lazyResourceArnList: string;

  constructor(stack: Stack) {
    const rootStack = getRootStack(stack);
    if (stack !== rootStack) throw new Error('RetainedAspect must be placed on root stack.');
    this.stack = stack;

    this._lazyResourceArnList = Lazy.string({
      produce: () => {
        return JSON.stringify(this._retainedResourceArns);
      },
    });

    new CfnOutput(rootStack, `${RETAINED_BASENAME}Export`, { //NOSONAR (S1848) - cdk construct is used
      exportName: RETAINED_RESOURCES_EXPORT,
      description: 'List of resources that are retained after deleting the solution stack.',
      value: Lazy.string({
        produce: () => {
          if (this._retainedResourceArns.length > 10) {
            return RETAINED_COUNT_EXCEEDING_MESSAGE;
          }
          return this._lazyResourceArnList;
        },
      }),
    });

    Aspects.of(stack).add(this);
  }

  get retainedResourceArns(): string {
    return this._lazyResourceArnList;
  }

  /**
   * Grants read access to the parameter that stores list of retained resources and returns the name of the parameter.
   *
   * This will create a decoupled IStringParameter resource to prevent circular dependencies.
   * @param grantableConstruct
   * @returns {string} Name of the parameter.
   */
  bindLambda(_lambda: lambda.Function): void {
    // Grant access to delete all retained resources
    iam.Grant.addToPrincipal({
      grantee: _lambda,
      actions: RETAINED_POLICY_ACTIONS,
      resourceArns: Lazy.list({
        produce: () => {
          return this._retainedResourcesForPolicy;
        },
      }),
    });

    _lambda.addEnvironment(RETAINED_RESOURCES_ENV_VAR, this.retainedResourceArns);
  }

  public visit(node: IConstruct): void {
    if (node instanceof CfnResource && node.cfnOptions.deletionPolicy === CfnDeletionPolicy.RETAIN) {
      if ('attrArn' in node) {
        const arn = (node as any).attrArn;
        this._retainedResourceArns.push(arn);
        this._retainedResourcesForPolicy.push(arn);
        if ((node as CfnResource) instanceof CfnBucket) {
          // object resource for buckets
          this._retainedResourcesForPolicy.push(`${arn}/*`);
        }
      } else if (node instanceof CfnLogStream) {
        // arn:${Partition}:logs:${Region}:${Account}:log-group:${LogGroupName}:log-stream:${LogStreamName}
        const arn = this.stack.formatArn({
          service: 'logs',
          resource: `log-group:${node.logGroupName}:log-stream:${node.logStreamName}`,
        });
        this._retainedResourceArns.push(arn);
        this._retainedResourcesForPolicy.push(arn);
      } else {
        throw new Error(`RetainedAspect failed to resolve arn for node ${node.ref} at ${node.node.path}`);
      }
    }
  }
}
