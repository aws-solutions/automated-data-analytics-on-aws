/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { getStackSnapshotTemplate } from '@ada/infra-common/services/testing/stack-synth';
import StackToTest from './kms-stack';

describe('stack', () => {
  it('snapshots', () => {
    expect(getStackSnapshotTemplate(StackToTest as any)).toMatchSnapshot();
  });
});
