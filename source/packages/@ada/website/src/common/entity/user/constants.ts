/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { DefaultUser } from '@ada/infra';

// Can't import from @ada/infra in website, so have to just hardocde here
export const SYSTEM_USER = 'system' as DefaultUser.SYSTEM;
