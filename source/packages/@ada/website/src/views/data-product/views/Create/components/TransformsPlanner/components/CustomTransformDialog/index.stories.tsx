/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { CustomTransformDialog, CustomTransformDialogProps, EXAMPLE_SCRIPT } from '.';
import { CustomTransformScript, FormDataSchema } from '../../../../utils';
import { LL } from '@ada/strings';
import { MockedFunction } from 'ts-jest/dist/utils/testing';
import { TransformPlannerContextProvider } from '../../context';
import { act } from '@testing-library/react';
import { delay } from '$common/utils';
import { userEvent, waitFor, within } from '@storybook/testing-library';

const CUSTOM_SCRIPT: CustomTransformScript = {
  namespace: 'test',
  name: 'My Custom Transform',
  scriptId: 'my_custom_transform',
  description: 'Custom script description',
  inlineScriptContent: EXAMPLE_SCRIPT,
}

export default {
  title: 'Views/DataProduct/Create/TransformPlanner/CustomTransformDialog',
  component: CustomTransformDialog,
  parameters: {
    sourceSchema: {
      preview: fixtures.DATAPRODUCT_PREVIEW,
    } as Partial<FormDataSchema>,
  },
  args: {
    transform: {
      namespace: CUSTOM_SCRIPT.namespace,
    },
    onCancel: jest.fn(),
    onSave: jest.fn(),
  },
} as ComponentMeta<typeof CustomTransformDialog>;

const Template: ComponentStory<typeof CustomTransformDialog> = (args, context) => {
  (args.onSave as MockedFunction<CustomTransformDialogProps['onSave']>).mockReset();

  return (
    <TransformPlannerContextProvider {...(context.parameters as any)}>
      <CustomTransformDialog {...args} />
    </TransformPlannerContextProvider>
  );
};

export const Primary = Template.bind({});

export const Coverage = Template.bind({});
Coverage.play = async ({ args, canvasElement }) => {
  // ensure state is fully resolved
  await act(async () => {
    await delay(100);
  });

  const modalRoot = canvasElement.ownerDocument.body.querySelector('#modal-root') as HTMLElement;
  if (modalRoot == null) throw new Error('Failed to find modal-root');
  const modal = within(modalRoot);

  await act(async () => {
    const input = await modal.findByLabelText(LL.ENTITY['Transform@'].name.label());
    await userEvent.type(input, CUSTOM_SCRIPT.name, { delay: 10 });
  });
  await act(async () => {
    const input = await modal.findByLabelText(LL.ENTITY['Transform@'].description.label());
    await userEvent.type(input, CUSTOM_SCRIPT.description!, { delay: 10 });
  });

  await act(async () => {
    userEvent.click(modal.getByText('Submit'));
  });

  await waitFor(async () => {
    expect(args.onSave as MockedFunction<CustomTransformDialogProps['onSave']>).toBeCalledWith(
      expect.objectContaining({
        ...CUSTOM_SCRIPT,
        // encoding difference during storybook/jest prevent full match
        inlineScriptContent: expect.stringContaining('def apply_transform'),
      }),
    );
  });
};
