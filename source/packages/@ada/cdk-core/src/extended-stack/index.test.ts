/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { App, CfnElement, CfnOutput, CfnParameter, CfnResource, CfnStack, Stack } from 'aws-cdk-lib';
import { Bucket, CfnBucket } from 'aws-cdk-lib/aws-s3';
import { CfnTable } from 'aws-cdk-lib/aws-dynamodb';
import { ExtendedNestedStack, ExtendedStack, cleanLogicalId } from './index';

const NODE_HASH = '######';

describe('extended-stack', () => {
  describe('ExtendedStack class', () => {
    it('should override allocateLogicalId', () => {
      const spy = jest.spyOn(ExtendedStack.prototype, 'allocateLogicalId' as any);
      const app = new App();
      const stack = new ExtendedStack(app, 'TestStack');
      new Bucket(stack, 'MyBucket');
      app.synth();
      expect(spy).toHaveBeenCalled();
    });
  });
  describe('ExtendedNestedStack class', () => {
    it('should override allocateLogicalId', () => {
      const spy = jest.spyOn(ExtendedNestedStack.prototype, 'allocateLogicalId' as any);
      const app = new App();
      const stack = new ExtendedStack(app, 'TestStack');
      const nestedStack = new ExtendedNestedStack(stack, 'TestNestedStack');
      new Bucket(nestedStack, 'MyBucket');
      app.synth();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('cleanLogicalId', () => {
    it('should replace XXXNestedStackXXXNestedStackResource with XXXStack', () => {
      const element: CfnResource = Object.assign(Object.create(CfnResource.prototype), {
        node: {
          id: 'TestId',
          path: 'TestStack/XXXNestedStackXXXNestedStackResource',
        },
      });
      expect(cleanLogicalId(element, 'XXXNestedStackXXXNestedStackResource' + NODE_HASH)).toBe('XXXStack' + NODE_HASH);
    });
    it('should remove duplicate resource type naming', () => {
      const element: CfnResource = Object.assign(Object.create(CfnResource.prototype), {
        cfnResourceType: CfnStack.CFN_RESOURCE_TYPE_NAME,
        node: {
          id: 'TestId',
          path: 'TestStack/XXXStackStack',
        },
      });
      expect(cleanLogicalId(element, 'XXXStackStack' + NODE_HASH)).toBe('XXXStack' + NODE_HASH);
    });
    it('should replace cryptic lowercase naming with pascal case', () => {
      const element: CfnResource = Object.assign(Object.create(CfnResource.prototype), {
        node: {
          id: 'Test-name-with-lower-case',
          path: 'TestStack/Test-name-with-lower-case',
        },
      });
      expect(cleanLogicalId(element, 'Testnamewithlowercase' + NODE_HASH)).toBe('TestNameWithLowerCase' + NODE_HASH);
    });
    it('should use raw node.id for DynamoDB:Table', () => {
      const table: CfnTable = Object.create(CfnTable.prototype);
      const element: CfnTable = Object.assign(table, {
        node: {
          id: 'Resource',
          path: 'TestStack/MyName/Resource',
          scope: {
            node: {
              defaultChild: table,
              id: 'MyName',
              path: 'TestStack/MyName',
            },
          },
        },
      });
      expect(cleanLogicalId(element, 'MyNameResource' + NODE_HASH)).toBe('MyName');
    });
    it('should use raw node.id for S3:Bucket', () => {
      const bucket: CfnBucket = Object.create(CfnBucket.prototype);
      const element: CfnBucket = Object.assign(bucket, {
        node: {
          id: 'Resource',
          path: 'TestStack/MyName/Resource',
          scope: {
            node: {
              defaultChild: bucket,
              id: 'MyName',
              path: 'TestStack/MyName',
            },
          },
        },
      });
      expect(cleanLogicalId(element, 'MyNameResource' + NODE_HASH)).toBe('MyName');
    });

    describe('edge cases', () => {
      it('should not modify non resource elements', () => {
        const element: CfnElement = Object.assign(Object.create(CfnElement.prototype), {
          node: {
            id: 'TestId',
            path: 'TestStack/XXXNestedStackXXXNestedStackResource',
          },
        });
        // normally for resources this would get replaced
        expect(cleanLogicalId(element, 'XXXNestedStackXXXNestedStackResource')).toBe(
          'XXXNestedStackXXXNestedStackResource',
        );
      });
      it('should not modify CfnParameter names', () => {
        const NAME = 'myCamelCaseName';
        const stack = new Stack();
        const param = new CfnParameter(stack, NAME);
        expect(cleanLogicalId(param, NAME)).toBe(NAME);
      });
      it('should not modify CfnOutput names', () => {
        const NAME = 'myCamelCaseName';
        const stack = new Stack();
        const param = new CfnOutput(stack, NAME, { value: 'foo' });
        expect(cleanLogicalId(param, NAME)).toBe(NAME);
      });
    });
  });
});
