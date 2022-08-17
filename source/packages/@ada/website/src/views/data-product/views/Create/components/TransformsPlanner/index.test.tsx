/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as stories from './index.stories';
import { BuiltInTransforms } from '@ada/transforms';
import { composeStories } from '@storybook/testing-react';
import { render } from '@testing-library/react';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('@ada/api-client');

const { Primary } = composeStories(stories);

describe('CreateDataProductView/TransformPlanner', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
  });

  it('primary', async () => {
    const { container, findByText } = render(<Primary {...(Primary.args as any)} />);

    expect(container).toBeDefined();

    const transforms = Object.values(BuiltInTransforms);

    for (const transform of transforms) {
      expect(await findByText(transform.name)).toBeDefined();
    }
  });

  // TODO: this does not work because of jsdom does not support `getBoundingClientRect` which dnd requires - https://github.com/jsdom/jsdom/issues/1590
  // it('coverage', async () => {
  //   const { container } = render(<Coverage {...(Coverage.args as any)} />);
  //   expect(container).toBeDefined();

  //   await act(async () => {
  //     await delay(1000);
  //   })

  //   await act(async () => {
  //     await Coverage.play({ canvasElement: container });
  //   });

  //   await act(async () => {
  //     await delay(200);
  //   })

  //   const transformPlan = screen.getByTestId('transform-plan');

  //   expect(transformPlan).toMatchSnapshot();
  // });
});
