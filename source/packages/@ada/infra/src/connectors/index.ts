/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Connectors } from './interface';

export * from './interface';

export * from './sources';

export * as Common from './common';

console.info('CONNECTORS:REGISTERED:IDS:', Connectors.getRegisteredIds().join(', '));
