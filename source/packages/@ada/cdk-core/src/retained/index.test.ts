/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CfnResource, NestedStack, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Match, Template } from 'aws-cdk-lib/assertions';
import {
  RETAINED_COUNT_EXCEEDING_MESSAGE,
  RETAINED_POLICY_ACTIONS,
  RETAINED_RESOURCES_ENV_VAR,
  RETAINED_RESOURCES_EXPORT,
  RetainedAspect,
} from './index';
import { TestStack } from '../testing';

describe('retained', () => {
  describe('RetainedAspect', () => {
    it('should output list of retained resources', () => {
      const stack = new TestStack();
      new RetainedAspect(stack);

      new Bucket(stack, 'RetainedBucket1', {
        removalPolicy: RemovalPolicy.RETAIN,
      });
      new Bucket(stack, 'RetainedBucket2', {
        removalPolicy: RemovalPolicy.RETAIN,
      });
      new Bucket(stack, 'DestroyedBucket1', {
        removalPolicy: RemovalPolicy.DESTROY,
      });

      const template = Template.fromStack(stack);

      template.hasOutput(`${RETAINED_RESOURCES_EXPORT}Export`, {
        Value: {
          'Fn::Join': [
            '',
            [
              '["',
              {
                'Fn::GetAtt': ['RetainedBucket1', 'Arn'],
              },
              '","',
              {
                'Fn::GetAtt': ['RetainedBucket2', 'Arn'],
              },
              '"]',
            ],
          ],
        },
      });
    });

    it('should export message to lookup retained resources if more than 10', () => {
      const stack = new TestStack();
      new RetainedAspect(stack);

      Array.from(Array(11)).forEach((x, i) => {
        new Bucket(stack, `Bucket${i}`, {
          removalPolicy: RemovalPolicy.RETAIN,
        });
      });

      const template = Template.fromStack(stack);

      template.hasOutput(`${RETAINED_RESOURCES_EXPORT}Export`, {
        Value: RETAINED_COUNT_EXCEEDING_MESSAGE,
      });
    });

    it('should bind lambda', () => {
      const stack = new TestStack();
      const aspect = new RetainedAspect(stack);

      new Bucket(stack, 'Bucket', {
        removalPolicy: RemovalPolicy.RETAIN,
      });

      const lambdaFunction = new lambda.Function(stack, 'Lambda', {
        code: lambda.AssetCode.fromInline('foo'),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_16_X,
      });

      aspect.bindLambda(lambdaFunction);

      const template = Template.fromStack(stack);

      template.hasResourceProperties(lambda.CfnFunction.CFN_RESOURCE_TYPE_NAME, {
        Environment: Match.objectLike({
          Variables: {
            [RETAINED_RESOURCES_ENV_VAR]: Match.anyValue(),
          },
        }),
      });
      template.hasResourceProperties(iam.CfnPolicy.CFN_RESOURCE_TYPE_NAME, {
        PolicyDocument: Match.objectLike({
          Statement: [
            {
              Action: RETAINED_POLICY_ACTIONS,
            },
          ],
        }),
      });
    });

    it('should get arn for supported resources', () => {
      const stack = new TestStack();
      new RetainedAspect(stack);
      new Bucket(stack, 'Bucket', {
        removalPolicy: RemovalPolicy.RETAIN,
      });
      new logs.LogStream(stack, 'LogStream', {
        logGroup: new logs.LogGroup(stack, 'LogGroup'),
        logStreamName: 'stream',
        removalPolicy: RemovalPolicy.RETAIN,
      });
      new kms.Key(stack, 'Key', { removalPolicy: RemovalPolicy.RETAIN });

      const template = Template.fromStack(stack);

      template.hasOutput(`${RETAINED_RESOURCES_EXPORT}Export`, {
        Value: {
          'Fn::Join': [
            '',
            [
              '["',
              {
                'Fn::GetAtt': ['Bucket', 'Arn'],
              },
              '","',
              {
                'Fn::GetAtt': ['LogGroupF5B46931', 'Arn'],
              },
              '","arn:',
              {
                Ref: 'AWS::Partition',
              },
              ':logs:ap-southeast-1:1111111111:log-group:',
              {
                Ref: 'LogGroupF5B46931',
              },
              ':log-stream:stream","',
              {
                'Fn::GetAtt': ['Key961B73FD', 'Arn'],
              },
              '"]',
            ],
          ],
        },
      });
    });

    it('should throw unable to get arn from retained resource', () => {
      const stack = new TestStack();
      new RetainedAspect(stack);
      const resource = new CfnResource(stack, 'UnsupportedResource', { type: 'Test' });
      resource.applyRemovalPolicy(RemovalPolicy.RETAIN);
      expect(() => Template.fromStack(stack)).toThrow();
    });

    it('should only be added to root stack', () => {
      const stack = new TestStack();
      const nestedStack = new NestedStack(stack, 'NestedStack');

      expect(() => new RetainedAspect(nestedStack)).toThrow();
    });

    it('should be able to get deep reference from nested construct', () => {
      const stack = new TestStack();
      const aspect = new RetainedAspect(stack);
      const nestedStack = new NestedStack(stack, 'NestedStack');

      const deepConstruct = new (class DeepConstruct extends Construct {
        aspect: RetainedAspect;

        constructor(scope: Construct, id: string) {
          super(scope, id);

          this.aspect = RetainedAspect.of(this);
        }
      })(nestedStack, 'DeepConstruct');

      expect(deepConstruct.aspect).toBe(aspect);
    });

    it('should fail to get aspect from nested construct before defined on root stack', () => {
      const stack = new TestStack();
      const nestedStack = new NestedStack(stack, 'NestedStack');

      expect(() => {
        new (class DeepConstruct extends Construct {
          aspect: RetainedAspect;

          constructor(scope: Construct, id: string) {
            super(scope, id);

            this.aspect = RetainedAspect.of(this);
          }
        })(nestedStack, 'DeepConstruct');
      }).toThrow();
    });
  });
});
