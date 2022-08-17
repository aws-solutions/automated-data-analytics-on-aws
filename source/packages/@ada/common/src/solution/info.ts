/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { startCase } from 'lodash';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg: SolutionInfo = require('../../../../../../source/package.json');

export interface SolutionInfo {
  /**
   * Identifier of solution is version scoped name.
   */
  readonly id: string;
  /**
   * Name of the solution.
   */
  readonly name: string;
  /**
   * Title of the solution.
   */
  readonly title: string;
  /**
   * A description of the solution.
   */
  readonly description: string;

  /**
   * The version of the solution in SEMVER format.
   */
  readonly version: string;

  /**
   * The AWS Solution ID
   */
  readonly awsSolutionId: string;
  /**
   * The AWS Solution Release Version
   */
  readonly awsSolutionVersion: string;
}

let info: SolutionInfo;

export function solutionInfo(): SolutionInfo {
  if (info == null) {
    info = {
      id: `${pkg.name}@${pkg.version}`,
      name: startCase(pkg.name),
      title: pkg.title,
      description: pkg.description,
      version: pkg.version,
      awsSolutionId: pkg.awsSolutionId,
      awsSolutionVersion: pkg.awsSolutionVersion,
    } as SolutionInfo;
  }

  return info;
}

export const getNestedStackDescription = (solution: SolutionInfo, stackShortDescription: string): string =>
`(${solution.awsSolutionId}-${stackShortDescription}) - ${solution.title}. Version ${solution.awsSolutionVersion}`;