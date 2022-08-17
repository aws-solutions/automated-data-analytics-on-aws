/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { defineConfig } from 'cypress'

export default defineConfig({
  includeShadowDom: true,
  defaultCommandTimeout: 10000,
  reporter: 'junit',
  reporterOptions: {
    toConsole: true,
    mochaFile: 'cypress/results/ui-test-output-[hash].xml',
  },
  retries: {
    openMode: 0,
    runMode: 5,
  },
  env: {
    coverage: true,
    FAIL_FAST_STRATEGY: 'run',
    FAIL_FAST_ENABLED: true,
  },
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      return require('./cypress/plugins/index.ts').default(on, config)
    },
  },
})
