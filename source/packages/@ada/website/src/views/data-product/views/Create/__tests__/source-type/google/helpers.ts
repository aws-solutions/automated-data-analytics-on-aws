import { useImmediateEffect } from '$common/hooks';
import { setPersistentGoogleServiceAccountDetails } from '$source-type/google/common/google-session-credentials';
import * as fixtures from '$testing/__fixtures__';
import { GoogleServiceAccountAuth } from '@ada/common';
import { userEvent, within } from '@storybook/testing-library';
import { act } from '@testing-library/react';

export const GOOGLE_SOURCE_DETAILS: GoogleServiceAccountAuth = fixtures.GOOGLE_SERVICE_ACCOUNT;

export function useGoogleSourceTypeTestSetup () {
	useImmediateEffect(() => {
    setPersistentGoogleServiceAccountDetails(fixtures.GOOGLE_SERVICE_ACCOUNT);
  });
}

export async function selectMostRecentAuth (
	canvasElement: HTMLElement,
): Promise<void> {
	const { getByText } = within(canvasElement);
  await act(async () => {
    userEvent.click(getByText('Reuse most recent'));
  });
}
