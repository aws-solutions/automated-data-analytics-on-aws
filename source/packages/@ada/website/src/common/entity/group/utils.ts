/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DefaultGroupIds } from '@ada/common';
import { startCase } from 'lodash';

const SYSTEM_GROUPS = Object.values(DefaultGroupIds);

export function isSystemGroup(groupId: string): boolean {
  return SYSTEM_GROUPS.includes(groupId as any);
}

export function isDefaultGroup(groupId: string): boolean {
  return groupId === DefaultGroupIds.DEFAULT;
}

export function groupDisplayName(groupId: string): string {
  if (isDefaultGroup(groupId)) {
    groupId += ' User';
  }
  return startCase(groupId);
}

export function getGroupUrl(groupId: string): string {
  return `/groups/${groupId}`;
}
