/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import { BuiltInTransforms } from '@ada/transforms';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { DraggableResolvedTransform } from '../../types';
import { FormDataSchema } from '../../../../utils';
import { MockedFunction } from 'ts-jest/dist/utils/testing';
import { Script } from '@ada/api';
import { TransformArgsDialog, TransformArgsDialogProps } from '.';
import { TransformPlannerContextProvider } from '../../context';
import { act } from '@testing-library/react';
import { delay } from '$common/utils';
import { multiselectOptionEvent, selectOptionEvent } from '$testing/user-event';
import { userEvent, within } from '@storybook/testing-library';

const ResolvedTransforms = Object.fromEntries(
  Object.values(BuiltInTransforms).map((transform) => {
    const script: Script = {
      namespace: transform.namespace,
      scriptId: transform.id,
      name: transform.name,
      description: transform.description,
      helperText: transform.helperText,
      inputSchema: transform.inputSchema,
    };
    return [
      transform.id as keyof typeof BuiltInTransforms,
      {
        ...script,
        script,
        draggableId: `${transform.id}-drag-id`,
      } as DraggableResolvedTransform,
    ];
  }),
) as Record<keyof typeof BuiltInTransforms, DraggableResolvedTransform>;

export default {
  title: 'Views/DataProduct/Create/TransformPlanner/TransformArgsDialog',
  component: TransformArgsDialog,
  parameters: {
    sourceSchema: {
      preview: fixtures.DATAPRODUCT_PREVIEW,
    } as Partial<FormDataSchema>,
  },
  args: {
    index: 0,
    onCancel: jest.fn(),
    onSave: jest.fn(),
  },
} as ComponentMeta<typeof TransformArgsDialog>;

const Template: ComponentStory<typeof TransformArgsDialog> = (args, context) => {
  (args.onSave as MockedFunction<TransformArgsDialogProps['onSave']>).mockReset();

  return (
    <TransformPlannerContextProvider {...(context.parameters as any)}>
      <TransformArgsDialog {...args} />
    </TransformPlannerContextProvider>
  );
};

export const ApplyMapping = Template.bind({});

ApplyMapping.args = {
  transform: ResolvedTransforms['ada_apply_mapping'],
};
ApplyMapping.play = async ({ args, canvasElement }) => {
  // ensure state is fully resolved
  await act(async () => {
    await delay(100);
  });

  const modalRoot = canvasElement.ownerDocument.body.querySelector('#modal-root') as HTMLElement;
  if (modalRoot == null) throw new Error('Failed to find modal-root');
  const modal = within(modalRoot);

  await act(async () => {
    const oldName = await modal.findByLabelText('Old name');
    await userEvent.type(oldName, 'OLD_NAME', { delay: 10 });
  });
  await act(async () => {
    const newName = await modal.findByLabelText('New name');
    await userEvent.type(newName, 'NEW_NAME', { delay: 10 });
  });
  await selectOptionEvent(modalRoot, 'New type', 'string');

  await act(async () => {
    userEvent.click(modal.getByText('Submit'));
  });

  expect(args.onSave as MockedFunction<TransformArgsDialogProps['onSave']>).toBeCalledWith(
    0,
    expect.objectContaining({
      inputArgs: {
        drop_fields: true,
        mappings: [
          {
            oldName: 'OLD_NAME',
            newName: 'NEW_NAME',
            newType: 'string',
          },
        ],
      },
    }),
  );
};

export const DropFields = Template.bind({});

DropFields.args = {
  transform: ResolvedTransforms['ada_drop_fields'],
};
DropFields.play = async ({ args, canvasElement }) => {
  // ensure state is fully resolved
  await act(async () => {
    await delay(100);
  });

  const modalRoot = canvasElement.ownerDocument.body.querySelector('#modal-root') as HTMLElement;
  if (modalRoot == null) throw new Error('Failed to find modal-root');
  const modal = within(modalRoot);

  // defined options
  await act(async () => {
    await multiselectOptionEvent(modalRoot, 'Fields to drop', 'age');
  });
  // freeSolo
  await act(async () => {
    const field = await modal.findByLabelText('Fields to drop');
    await userEvent.type(field, 'DROP_ME{enter}', { delay: 10 });
  });

  await act(async () => {
    userEvent.click(modal.getByText('Submit'));
  });

  expect(args.onSave as MockedFunction<TransformArgsDialogProps['onSave']>).toBeCalledWith(
    0,
    expect.objectContaining({
      inputArgs: {
        paths: ['age', 'DROP_ME'],
      },
    }),
  );
};

export const SelectFields = Template.bind({});

SelectFields.args = {
  transform: ResolvedTransforms['ada_select_fields'],
};
SelectFields.play = async ({ args, canvasElement }) => {
  // ensure state is fully resolved
  await act(async () => {
    await delay(100);
  });

  const modalRoot = canvasElement.ownerDocument.body.querySelector('#modal-root') as HTMLElement;
  if (modalRoot == null) throw new Error('Failed to find modal-root');
  const modal = within(modalRoot);

  // defined options
  await act(async () => {
    await multiselectOptionEvent(modalRoot, 'Fields to select', 'age');
  });
  // freeSolo
  await act(async () => {
    const field = await modal.findByLabelText('Fields to select');
    await userEvent.type(field, 'SELECT_ME{enter}', { delay: 10 });
  });

  await act(async () => {
    userEvent.click(modal.getByText('Submit'));
  });

  expect(args.onSave as MockedFunction<TransformArgsDialogProps['onSave']>).toBeCalledWith(
    0,
    expect.objectContaining({
      inputArgs: {
        paths: ['age', 'SELECT_ME'],
      },
    }),
  );
};
