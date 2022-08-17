/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { LL } from '@ada/strings';
import { SourceType } from '@ada/common';
import { act } from '@testing-library/react';
import { delay } from '$common/utils';
import { selectOptionEvent } from '$testing/user-event';
import { userEvent, within } from '@storybook/testing-library';
import { DataProductInput, DataProductUpdateTriggerType } from '@ada/api';
import assert from 'assert';
import { DELAY } from '$testing/interaction';
import { useImmediateEffect } from '$common/hooks';

export async function gotoSourceTypeDetails (
	canvasElement: HTMLElement,
	sourceType: SourceType
): Promise<void> {
	const { getByText, getByLabelText, getByTestId } = within(canvasElement);

  // ensure state is fully resolved
  await act(async () => {
    await delay(DELAY.SHORT);
  });

  await selectOptionEvent(canvasElement, LL.ENTITY.Domain(), fixtures.DOMAIN.domainId);

  await userEvent.type(getByLabelText(
		LL.ENTITY['DataProduct@'].name.label()),
		fixtures.DATA_PRODUCT.name,
		{ delay: 2 }
	);
  await userEvent.type(getByLabelText(
		LL.ENTITY['DataProduct@'].description.label()),
		fixtures.DATA_PRODUCT.description!,
		{ delay: 2 }
	);

  await act(async () => {
    userEvent.click(getByTestId(`card-select-${sourceType}`));

    userEvent.click(getByText('Next'));
  });

	await act(async () => {
    await delay(DELAY.SHORT);
		canvasElement.closest('html')!.scrollTop = 0;
  });
}

export async function selectUpdateTriggerType (
	canvasElement: HTMLElement,
	updateTrigger: DataProductUpdateTriggerType
): Promise<HTMLInputElement> {
	const trigger = canvasElement.querySelector(
		`input[name="updateTrigger.triggerType"][value="${updateTrigger}"]`
	) as HTMLInputElement;
  await act(async () => {
    userEvent.click(trigger);
  });
	return trigger;
}

export async function clickNext(canvasElement: HTMLElement): Promise<void> {
	await act(async () => {
		userEvent.click(within(canvasElement).getByText('Next'))
	});

	await act(async () => {
		await delay(DELAY.MEDIUM);
	})
}

export async function assertReview(canvasElement: HTMLElement, details: Record<string, string>): Promise<void> {
	const { getByText } = within(canvasElement);

	await act(async () => {
		await delay(DELAY.MEDIUM);
	})

	assert(getByText(LL.VIEW.wizard.STEP.review.title(), { selector: 'h1' }), 'Should show review step');

	assertKV(canvasElement, LL.ENTITY['DataProduct@'].name.label(), fixtures.DATA_PRODUCT.name);
	assertKV(canvasElement, LL.ENTITY['DataProduct@'].description.label(), fixtures.DATA_PRODUCT.description!);

	const sourceDetailsContainer = getReviewSourceDetails(canvasElement);
	for (const [key, value] of Object.entries(details)) {
		assertKV(sourceDetailsContainer, key, value);
	}
}

export function assertKV (container: HTMLElement, key: string, value: string): void {
	const { getByText } = within(container);
	const keyElement = getByText(key, { selector: 'div' });
	assert(keyElement, `KV key "${key}" should be defined`);
	assert(within(keyElement.parentElement!).getByText(value, { selector: 'span' }), `KV key "${key}" should have value "${value}"`);
}

export function getReviewSourceDetails (canvasElement: HTMLElement): HTMLElement {
	const { getByText } = within(canvasElement);
	const titleElement = getByText(LL.VIEW.DATA_PRODUCT.Wizard.SourceDetails.title(), { selector: 'h2' });
	return titleElement.closest('div[data-testid="layout-stack"]')!
}

export function useSourceTypeTestApiMocks () {
	useImmediateEffect(() => {
    API.postDataProductDomainDataProduct.mockResolvedValue({
      domainId: fixtures.DATA_PRODUCT.domainId,
      dataProductId: fixtures.DATA_PRODUCT.dataProductId,
    });
    return () => {
      jest.clearAllMocks();
    };
  });
}

export async function assertSubmit(canvasElement: HTMLElement, input: Partial<DataProductInput>): Promise<void> {
	const { getByText } = within(canvasElement);

	await act(async () => {
		userEvent.click(getByText('Submit'));
	});

	await act(async () => {
		await delay(DELAY.SHORT);
	});

	expect(API.postDataProductDomainDataProduct).toBeCalledWith(expect.objectContaining({
		domainId: fixtures.DATA_PRODUCT.domainId,
		dataProductId: fixtures.DATA_PRODUCT.dataProductId,
		dataProductInput: expect.objectContaining({
			name: fixtures.DATA_PRODUCT.name,
			description: fixtures.DATA_PRODUCT.description,
			...input,
			sourceDetails: expect.objectContaining(input.sourceDetails),
		}),
	}), undefined);
}
