/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import * as stories from './index.stories';
import { IGNORE_WHILE_EDITING } from '.';
import { LL } from '@ada/strings';
import { act, render } from '@testing-library/react';
import { composeStories } from '@storybook/testing-react';
import { delay } from '$common/utils';
import { last } from 'lodash';

jest.retryTimes(3);
jest.setTimeout(30000);

jest.mock('@ada/api-client');

const { Primary, Coverage } = composeStories(stories);

describe('views/DataProduct/components/SchemaRenderer', () => {
  it('primary', async () => {
    const { container } = render(<Primary {...(Primary.args as any)} />);

    expect(container).toBeDefined();
  });
  it('coverage', async () => {
    const { domainId, dataProductId } = fixtures.DATA_PRODUCT;
    const consoleSpy = jest.spyOn(console, 'info');
    const { container, findAllByText } = render(<Coverage {...(Coverage.args as any)} />);

    await act(async () => {
      await delay(100);
    });

    await act(async () => {
      await Coverage.play({ canvasElement: container });
    });

    await act(async () => {
      await delay(100);
    });

    expect(container).toBeDefined();

    expect((await findAllByText(LL.ENTITY.DataProduct__UPDATED(`${domainId}.${dataProductId}`))).length).toBe(2);

    expect(last(consoleSpy.mock.calls)![0]).toBe(IGNORE_WHILE_EDITING);
  });
});
