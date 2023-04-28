/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import { MOCK_API_CLIENT as API } from '@ada/api-client/mock';
import { Connectors } from '@ada/connectors';
import { DELAY } from '$testing/interaction';
import { DataProductInput, DataProductUpdateTriggerType } from '@ada/api';
import { LL } from '@ada/strings';
import { act } from '@testing-library/react';
import { delay } from '$common/utils';
import { selectOptionEvent } from '$testing/user-event';
import { useImmediateEffect } from '$common/hooks';
import { userEvent, within } from '@storybook/testing-library';
import assert from 'assert';

export async function gotoSourceTypeDetails(canvasElement: HTMLElement, sourceType: Connectors.ID): Promise<void> {
  const { getByText, getByLabelText, getByTestId } = within(canvasElement);

  // ensure state is fully resolved
  await act(async () => {
    await delay(DELAY.SHORT);
  });

  await selectOptionEvent(canvasElement, LL.ENTITY.Domain(), fixtures.DOMAIN.domainId);

  await userEvent.type(getByLabelText(LL.ENTITY['DataProduct@'].name.label()), fixtures.DATA_PRODUCT.name, {
    delay: 2,
  });
  await userEvent.type(
    getByLabelText(LL.ENTITY['DataProduct@'].description.label()),
    fixtures.DATA_PRODUCT.description!,
    { delay: 2 },
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

export async function selectUpdateTriggerType(
  canvasElement: HTMLElement,
  updateTrigger: DataProductUpdateTriggerType,
): Promise<HTMLInputElement> {
  const trigger = canvasElement.querySelector(
    `input[name="updateTrigger.triggerType"][value="${updateTrigger}"]`,
  ) as HTMLInputElement;
  await act(async () => {
    userEvent.click(trigger);
  });
  // ensure state is fully resolved
  await act(async () => {
    await delay(DELAY.SHORT);
  });
  return trigger;
}

export async function selectUpdatePolicy(canvasElement: HTMLElement, updatePolicy: string): Promise<HTMLInputElement> {
  const policy = canvasElement.querySelector(
    `input[name="updateTrigger.updatePolicy"][value="${updatePolicy}"]`,
  ) as HTMLInputElement;
  await act(async () => {
    userEvent.click(policy);
  });
  // ensure state is fully resolved
  await act(async () => {
    await delay(DELAY.SHORT);
  });

  return policy;
}

export async function clickNext(canvasElement: HTMLElement): Promise<void> {
  await act(async () => {
    userEvent.click(within(canvasElement).getByText('Next'));
  });

  await act(async () => {
    await delay(DELAY.MEDIUM);
  });
}

export async function assertReview(
  canvasElement: HTMLElement,
  sourceType: Connectors.ID,
  details: Record<string, string>,
): Promise<void> {
  const { queryByText } = within(canvasElement);

  await act(async () => {
    await delay(DELAY.MEDIUM);
  });

  assert(queryByText(LL.VIEW.wizard.STEP.review.title(), { selector: 'h1' }), 'Should show review step');

  assertKV(canvasElement, LL.ENTITY['DataProduct@'].name.label(), fixtures.DATA_PRODUCT.name);
  assertKV(canvasElement, LL.ENTITY['DataProduct@'].description.label(), fixtures.DATA_PRODUCT.description!);

  const connector = Connectors.find(sourceType);

  const sourceDetailsContainer = getReviewSourceDetails(canvasElement);
  for (const { key, label, valueRenderer } of connector.VIEW.Summary.properties) {
    const value = valueRenderer ? valueRenderer(details[key as any]) : details[key as any];
    assertKV(sourceDetailsContainer, label, value);
  }
}

export function assertKV(container: HTMLElement, key: string, value: string | string[]): void {
  const { queryByText } = within(container);
  const keyElement = queryByText(key, { selector: 'div' });
  assert(keyElement, `KV key "${key}" should be defined`);
  const parent = within(keyElement.parentElement!);

  if (Array.isArray(value)) {
    for (const v of value) {
      assert(parent.queryAllByText(v, { selector: 'span' }), `KV key "${key}" should have value "${v}"`);
    }
  } else {
    assert(parent.queryAllByText(value, { selector: 'span' }), `KV key "${key}" should have value "${value}"`);
  }
}

export function getReviewSourceDetails(canvasElement: HTMLElement): HTMLElement {
  const { getByText } = within(canvasElement);
  const titleElement = getByText(LL.VIEW.DATA_PRODUCT.Wizard.SourceDetails.title(), { selector: 'h2' });
  return titleElement.closest('div[data-testid="layout-stack"]')!;
}

export function useSourceTypeTestApiMocks() {
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

  expect(API.postDataProductDomainDataProduct).toBeCalledWith(
    expect.objectContaining({
      domainId: fixtures.DATA_PRODUCT.domainId,
      dataProductId: fixtures.DATA_PRODUCT.dataProductId,
      dataProductInput: expect.objectContaining({
        name: fixtures.DATA_PRODUCT.name,
        description: fixtures.DATA_PRODUCT.description,
        ...input,
        sourceDetails: expect.objectContaining(input.sourceDetails),
      }),
    }),
    undefined,
  );

  expect(
    Connectors.Schema.validateDataProductInput(API.postDataProductDomainDataProduct.mock.calls[0][0].dataProductInput)
      .valid,
  ).toBe(true);
}
