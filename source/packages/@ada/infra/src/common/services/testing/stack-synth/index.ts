/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fs from 'fs-extra';
import * as path from 'path';
import { CloudAssembly } from 'aws-cdk-lib/cx-api';
import { Construct } from 'constructs';
import { NestedStack } from 'aws-cdk-lib';
import { TEST_ENVIRONMENT, TestApp, cleanTemplateForSnapshot } from '@ada/cdk-core';
import { Template } from 'aws-cdk-lib/assertions';
import { solutionInfo } from '@ada/common';

type StackMapping = Record<string, string>;

interface StackSynthContext {
  // app: App;
  // rootStack: Stack;
  // nestedStacks: NestedStack[];
  RootStack: StackConstructor;
  assembly: CloudAssembly;
  stackMapping: StackMapping;
}

let synthContext: StackSynthContext;

function getRootStackClass(): StackConstructor {
  // Need to import root stack during runtime otherwise creates circular dep with commons
  return require('../../../../stacks/ada-stack').AdaStack;
}

export function getStackSynthContext(): StackSynthContext {
  if (synthContext == null) {
    const solution = solutionInfo();
    const RootStack = getRootStackClass();

    const PACKAGE_DIR = require('find-root')(__dirname)!;
    const CDK_OUT_DIR = path.join(PACKAGE_DIR, 'cdk.out.test');
    const STACK_MAPPING = path.join(CDK_OUT_DIR, '__stack_mapping__.json');

    if (fs.pathExistsSync(CDK_OUT_DIR)) {
      const assembly = new CloudAssembly(CDK_OUT_DIR);

      const stackMapping: StackMapping = fs.readJsonSync(STACK_MAPPING);

      synthContext = {
        RootStack,
        assembly,
        stackMapping,
      };
    } else {
      console.info('TESTING:STACK_SYNTH: generating assembly - should only be called once', CDK_OUT_DIR);
      // use consitent Date.now
      const _now = Date.now;
      Date.now = jest.fn(() => 1234567890123);

      // create test app
      const app = new TestApp({ outdir: CDK_OUT_DIR });
      // create full stack
      const rootStack = new RootStack(app, solution.name, { env: TEST_ENVIRONMENT });

      // synth and get assembly
      const assembly = app.synth();

      // reset timer
      Date.now = _now;

      const nestedStacks: NestedStack[] = rootStack.node
        .findAll()
        .filter((child: any) => NestedStack.isNestedStack(child)) as NestedStack[];

      const stackMapping: StackMapping = Object.fromEntries(
        nestedStacks.map((stack) => {
          return [stack.constructor.name || stack.stackName, stack.templateFile];
        }),
      );
      stackMapping[RootStack.name] = rootStack.templateFile;

      fs.writeFileSync(STACK_MAPPING, JSON.stringify(stackMapping, null, 2));

      synthContext = {
        RootStack,
        assembly,
        stackMapping,
      };
    }
  }

  return synthContext;
}

type StackConstructor = new (construct: Construct, id: string, props?: any | undefined) => any;

export function getSynthesizedStackTemplate(stackClass: StackConstructor): Template {
  const { assembly, stackMapping } = getStackSynthContext();

  const templateFullPath = path.join(assembly.directory, stackMapping[stackClass.name]);

  return Template.fromJSON(JSON.parse(fs.readFileSync(templateFullPath).toString('utf-8')));
}

/**
 * Gets a cleaned template for use in snapshot tests.
 * @see cleanTemplateForSnapshot()
 * @param stackClass THe class of the stack to get snapshot template for.
 * @returns
 */
export function getStackSnapshotTemplate(stackClass: StackConstructor): Template {
  return Template.fromJSON(cleanTemplateForSnapshot(getSynthesizedStackTemplate(stackClass).toJSON()));
}
