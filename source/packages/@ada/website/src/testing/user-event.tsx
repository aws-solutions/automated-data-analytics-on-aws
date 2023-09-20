/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { act, within } from '@testing-library/react';
import { delay } from '$common/utils';
import userEvent from '@testing-library/user-event';

export async function autoSuggestOptionEvent(
  canvasElement: HTMLElement,
  selectLabel: string,
  optionLabel: string) {
  const canvas = within(canvasElement);
  let openTrigger: HTMLElement;
  try {
    openTrigger = await within(canvas.getByLabelText(selectLabel)).findByRole('button');
  } catch (error) {
    // https://github.com/testing-library/dom-testing-library/issues/714
    openTrigger = await within(canvas.getByText(selectLabel).parentElement!).findByRole('button');
  }
  await delay(10);
  await act(async () => {
    userEvent.click(openTrigger);
  });
  await delay(10);
  const listbox = await within(canvasElement.ownerDocument.documentElement).findByRole('listbox');

  const option = await within(listbox).findByText(optionLabel);

  if (option == null) {
    throw new Error(`Failed to find option "${optionLabel}" for select "${selectLabel}"`);
  }

  await act(async () => {
    userEvent.click(option);
  });

  return option;
}

export async function selectOptionEvent(
  canvasElement: HTMLElement,
  selectLabel: string,
  optionValue: string,
): Promise<HTMLLIElement> {
  const canvas = within(canvasElement);
  let openTrigger: HTMLElement;
  try {
    openTrigger = await within(canvas.getByLabelText(selectLabel)).findByRole('button');
  } catch (error) {
    // https://github.com/testing-library/dom-testing-library/issues/714
    openTrigger = await within(canvas.getByText(selectLabel).parentElement!).findByRole('button');
  }
  await delay(10);
  await act(async () => {
    userEvent.click(openTrigger);
  });
  await delay(10);
  const option: HTMLLIElement = canvasElement.ownerDocument.querySelector(`[data-value="${optionValue}"]`)!;

  if (option == null) {
    throw new Error(`Failed to find option "${optionValue}" for select "${selectLabel}"`);
  }

  await act(async () => {
    userEvent.click(option);
  });

  return option;
}

export async function multiselectOptionEvent(
  canvasElement: HTMLElement,
  selectLabel: string,
  optionValue: string,
): Promise<HTMLLIElement> {
  const canvas = within(canvasElement);
  const input: HTMLElement = canvas.getByLabelText(selectLabel);
  await delay(10);
  await act(async () => {
    userEvent.click(input);
  });
  await delay(10);
  const popup = within(canvasElement.ownerDocument.body.querySelector('.MuiAutocomplete-popper') as HTMLElement);
  const option = popup.getByText(optionValue) as HTMLLIElement;

  if (option == null) {
    throw new Error(`Failed to find option "${optionValue}" for select "${selectLabel}"`);
  }

  await act(async () => {
    userEvent.click(option);
  });

  return option;
}
