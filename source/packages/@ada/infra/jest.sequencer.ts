/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import Sequencer from '@jest/test-sequencer';
import type { Test } from 'jest-runner';

/**
 * Run tests in their project order to avoid clashing environment variables in individual projects' jest.setup.ts
 */
export default class TestSequencer extends Sequencer {
  sort(tests: Test[]): Test[] {
    // Group tests by their project
    const testsByProjectName: { [projectName: string]: Test[] } = {};
    tests.forEach((test) => {
      const config = test.context.config;
      const name = config.displayName?.name || config.name;
      testsByProjectName[name] = [...(testsByProjectName[name] || []), test];
    });

    // Sort by project name first, then use jest's default sort for the tests within each project
    return Object.keys(testsByProjectName)
      .sort()
      .flatMap((projectName) => super.sort(testsByProjectName[projectName]));
  }
}
