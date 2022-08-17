/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductAccessLevel } from '@ada/api';

export interface DataProductPermissions {
  [group: string]: DataProductAccessLevel;
}
