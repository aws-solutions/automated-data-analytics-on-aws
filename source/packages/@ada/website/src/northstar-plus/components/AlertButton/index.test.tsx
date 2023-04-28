/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AlertButton } from '.';
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import userEvent from '@testing-library/user-event';

describe('AlertButton', () => {
		it('should render the button', () => {
      const handleConfirm = jest.fn();
			render(<AlertButton
        title='Alert Dialog Title'
        buttonText='ButtonText'
        confirmText='ConfirmText'
        onConfirm={handleConfirm}
      >
        Alert Dialog Content
      </AlertButton>);

      expect(screen.getByText('ButtonText')).toBeVisible();
      expect(screen.getByText('Alert Dialog Title')).not.toBeVisible();

      act(() => {
        userEvent.click(screen.getByText('ButtonText'));
      });

      expect(screen.getByText('Alert Dialog Title')).toBeVisible();
      expect(screen.getByText('Alert Dialog Content')).toBeVisible();

      act(() => {
        userEvent.click(screen.getByText('ConfirmText'));
      });

      expect(handleConfirm).toHaveBeenCalled();
      expect(screen.getByText('Alert Dialog Title')).not.toBeVisible();
		});
});
