/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as stories from './index.stories';
import { act, render } from '@testing-library/react';
import { composeStories } from '@storybook/testing-react';
import { delay } from '$common/utils';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('@ada/api-client');

const { ApplyMapping, DropFields, SelectFields } = composeStories(stories);

describe('CreateDataProductView/TransformPlanner/TransformArgsDialog', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
  });

  it('ApplyMapping', async () => {
    const { container } = render(<ApplyMapping {...(ApplyMapping.args as any)} />);
    expect(container).toBeDefined();

    await act(async () => {
      await delay(1000);
    });

    await act(async () => {
      await ApplyMapping.play({ canvasElement: container });
    });
  });

  it('DropFields', async () => {
    const { container } = render(<DropFields {...(DropFields.args as any)} />);
    expect(container).toBeDefined();

    await act(async () => {
      await delay(1000);
    });

    await act(async () => {
      await DropFields.play({ canvasElement: container });
    });
  });

  it('SelectFields', async () => {
    const { container } = render(<SelectFields {...(SelectFields.args as any)} />);
    expect(container).toBeDefined();

    await act(async () => {
      await delay(1000);
    });

    await act(async () => {
      await SelectFields.play({ canvasElement: container });
    });
  });
});
