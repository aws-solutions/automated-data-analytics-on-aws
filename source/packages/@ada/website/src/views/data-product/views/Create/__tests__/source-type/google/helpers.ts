/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { useImmediateEffect } from '$common/hooks';
import { setPersistentGoogleServiceAccountDetails } from '$connectors/google/common/google-session-credentials';
import { MOCK_GOOGLE_SERVICE_ACCOUNT_INPUT } from '$connectors/google/common/testing';
import { Common as ConnectorsCommon } from '@ada/connectors';
import { userEvent, within } from '@storybook/testing-library';
import { act } from '@testing-library/react';
import { delay } from '$common/utils';
import { DELAY } from '$testing/interaction';

export const GOOGLE_SOURCE_DETAILS: ConnectorsCommon.Google.IGoogleServiceAccountAuth =
  MOCK_GOOGLE_SERVICE_ACCOUNT_INPUT;

export function useGoogleSourceTypeTestSetup() {
  useImmediateEffect(() => {
    setPersistentGoogleServiceAccountDetails(MOCK_GOOGLE_SERVICE_ACCOUNT_INPUT);
  });
}

export async function selectMostRecentAuth(canvasElement: HTMLElement): Promise<void> {
  const { getByText } = within(canvasElement);
  await act(async () => {
    userEvent.click(getByText('Reuse most recent'));
  });
  await act(async () => {
    await delay(DELAY.SHORT);
  });
}
