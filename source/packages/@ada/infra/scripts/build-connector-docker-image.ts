/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as execa from 'execa';
import { Connectors } from '../src/connectors/interface';

/**
 * Build a connector docker image by name
 */
(async () => {
  const name = process.argv[2];
	const [, source] = Connectors.DOCKER_IMAGES.find(([_name, _source]) => name === _name) || []
	if (source == null) {
		throw new Error(`No docker image source defined for ${name}`);
	}

	await execa.command(`yarn build:image ${name} src/connectors/${source}`, { stdio: 'inherit', encoding: 'utf-8' });
})();
