/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)

import cypressFailFast = require('cypress-fail-fast/plugin');

export default (on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions): Cypress.PluginConfigOptions => {
  cypressFailFast(on, config);
  return config;
};
