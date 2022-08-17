/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CreateAndUpdateDetails } from '@ada/api/client';
import { SYSTEM_USER } from './constants';

export function isSystemEntity(entity?: CreateAndUpdateDetails): boolean | undefined {
  if (entity == null || entity.createdBy == null) return undefined;

  return entity.createdBy === SYSTEM_USER;
}
