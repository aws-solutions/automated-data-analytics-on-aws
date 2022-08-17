/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DefaultGroupIds, LensIds } from '@ada/common';
import { SelectOption } from 'aws-northstar/components/Select';
import { upperCase } from 'lodash';

export type GOVERNABLE_GROUPS = DefaultGroupIds.DEFAULT | DefaultGroupIds.POWER_USER | DefaultGroupIds.ADMIN;

export const GOVERNABLE_GROUPS = [DefaultGroupIds.DEFAULT, DefaultGroupIds.POWER_USER, DefaultGroupIds.ADMIN] as const; //NOSONAR (S2814:Duplicate) - false positive - type vs value

export const NONE_LENS = 'NONE';

export const NONE_LENS_OPTION: SelectOption = { label: '-', value: NONE_LENS };

// ordered list of supported UI lenses
export const LENSES = [LensIds.CLEAR, LensIds.HASHED, LensIds.HIDDEN];

export const LENSE_OPTIONS: SelectOption[] = LENSES.map(
  (lensId): SelectOption => ({ value: lensId, label: upperCase(lensId) }),
);

export const LENSE_OPTIONS_WITH_NULLABLE: SelectOption[] = [NONE_LENS_OPTION, ...LENSE_OPTIONS];
