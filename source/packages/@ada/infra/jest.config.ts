/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import createConfig from './jest.config.base';

/**
 * Root "infra" jest config is sequence orchestrator for running the nested jest.config.json
 * files within the infra/... directory. This config does not run suites itself, but
 * rather collects all the nested projects to run and then runs them in sequence.
 *
 * NOTE: THIS CURRENTLY CAUSES HEAP MEMORY ISSUES (Jest v26, Node >=18)
 * - using `v8` coverage provider gets it from about 25% to 90% complete
 *    - https://jest-archive-august-2023.netlify.app/docs/26.x/configuration#coverageprovider-string
 * - This is known issue with Jest, with workaround in v29 via `workerIdleMemoryLimit`
 *    - https://github.com/jestjs/jest/issues/11956 / https://github.com/jestjs/jest/issues/9980
 *    - https://jestjs.io/docs/configuration#workeridlememorylimit-numberstring
 *
 * Potential improvements have been followed from https://stackoverflow.com/a/76730397:
 * 1. [x] Currently implemented with minimal impact (~10%)
 * 2. [x][ Attempted but codebase is not compatible with SWC (const enums, namespaces, complex types in static infra)
 * 3. [x] Currently implemented with minimal impact (~10%)
 * 4. [ ] Not done yet, this is likely best nest step to solve as many `import *...` cases (aws-cdk-lib!)
 * 5. [ ] Have not yet investigated if have potential for dep replacement
 * 6. [ ] Updating deps is a good next step also
 *
 * WORKAROUND: Run test for each project as separate project in sequence, and merge coverage results.
 * The `test` script is now performing the following instead of call this config.
 * 1. Delete /coverage
 * 2. Run `yarn test:nested`... which runs all `test:nested:*` scripts in sequence
 *    - each outputs coverage to /coverage/nested/coverage-{name}.json
 * 3. Merge all nested coverage json reports to /coverage/coverage-full.json (yarn test:coverage:merge)
 * 5. Generate coverage reports [lcov, clover] (yarn test:coverage:report)
 */
export const config = createConfig({
  displayName: "infra",
  projects: ['<rootDir>/src/**/jest.config.ts'],
  testSequencer: '<rootDir>/jest.sequencer.ts',
});

export default config;
