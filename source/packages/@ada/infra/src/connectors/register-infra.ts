/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
/* eslint-disable */
import { Connectors } from './interface';

const state = {
	isRegistered: false,
};

(function (_state: typeof state) {
	if (!state.isRegistered) {
		state.isRegistered = true;

		console.info('CONNECTORS: Registering Infra [start] ...');

		require('./sources/register-infra');

		console.info('CONNECTORS:REGISTERED:INFRA:IDS:', Connectors.Infra.getRegisteredInfraIds().join(', '));

		console.info('CONNECTORS: Registering Infra [done]');
	}
})(state);
