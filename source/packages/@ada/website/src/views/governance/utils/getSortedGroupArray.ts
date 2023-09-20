/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  GOVERNABLE_GROUPS,
} from '$common/entity/ontology';
import { OntologyGovernanceGroup } from '../hooks';

const defaultGroupArray = (Array.from(GOVERNABLE_GROUPS) as string[]);

export const getSortedGroupArray = (governance?: Record<string, OntologyGovernanceGroup>) => governance &&
  Object.keys(governance).sort((x, y) => {
    const findIndexX = defaultGroupArray.findIndex(g => g === x) + 1 || 10;
    const findIndexY = defaultGroupArray.findIndex(g => g === y) + 1 || 10;

    if(findIndexX === findIndexY) {
      if(y > x) {
        return -1;
      }

      return 1;
    }

    return findIndexX - findIndexY;
  }).slice(0).map(k => governance[k]) || [];