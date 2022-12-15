/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as execa from 'execa';
import { Connectors } from '../src/connectors';

/**
 * Builds all connector docker images
 */
(async () => {
  console.info('Connectors.DOCKER_IMAGES:', Connectors.DOCKER_IMAGES);

  // NB: connectors will be built in order defined since enum values are enumerated in order
  // of definition. In this way the common dependencies will be ensured to build first.
  // If a connector has multiple docker images that have dependencies, they must be defined in order
  // to respect dependencies.
  for (const [name, source] of Connectors.DOCKER_IMAGES) {
    console.info('Building connector docker image: ', name, source);
    await execa.command(`yarn build:image ${name} src/connectors/${source}`, { stdio: 'inherit', encoding: 'utf-8' });
  }
})();
