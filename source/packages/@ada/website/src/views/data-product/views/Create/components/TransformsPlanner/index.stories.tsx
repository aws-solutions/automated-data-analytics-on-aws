/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import { BuiltInTransforms, TransformDefinition } from '@ada/transforms';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { FormData } from '../../utils';
import { FormRenderer } from 'aws-northstar';
import { Schema, componentTypes } from 'aws-northstar/components/FormRenderer';
import { Script } from '@ada/api';
import { TransformBuilder } from '.';
import { act } from '@testing-library/react';
import { delay } from '$common/utils';
import { fireEvent, userEvent, within } from '@storybook/testing-library';
import { isEmpty } from 'lodash';
import { multiselectOptionEvent, selectOptionEvent } from '$testing/user-event';
import { useCallback, useMemo } from 'react';

export default {
  title: 'Views/DataProduct/Create/TransformPlanner',
  component: TransformBuilder,
} as ComponentMeta<typeof TransformBuilder>;

const Template: ComponentStory<typeof TransformBuilder> = () => {
  const scripts = useMemo<Script[]>(() => {
    return Object.values(BuiltInTransforms).map((transform) => ({
      namespace: transform.namespace,
      scriptId: transform.id,
      name: transform.name,
      description: transform.description,
      helperText: transform.helperText,
      inputSchema: transform.inputSchema,
    }));
  }, []);

  const formSchema = useMemo<Schema>(() => {
    return {
      fields: [
        {
          component: componentTypes.CUSTOM,
          name: 'transformedSchema',
          CustomComponent: (props: any) => <TransformBuilder scripts={scripts} {...props} />,
        },
      ],
    };
  }, [scripts]);

  const initialValues = useMemo<Partial<FormData>>(() => {
    return {
      domainId: 'test',
      sourceType: 'S3',
      sourceDetails: {
        s3Path: 's3://test/file.csv',
      },
      updateTrigger: {
        triggerType: 'ON_DEMAND',
      },
      inferredSchema: {
        preview: fixtures.DATAPRODUCT_PREVIEW,
      },
    };
  }, []);

  const onSubmit = useCallback((data: Partial<FormData>) => {
    alert(JSON.stringify(data));
  }, []);

  return <FormRenderer schema={formSchema} initialValues={initialValues} onSubmit={onSubmit} />;
};

export const Primary = Template.bind({});

export const Coverage = Template.bind({});

Coverage.play = async ({ canvasElement }) => {
  const { getByTestId } = within(canvasElement);

  // ensure state is fully resolved
  await act(async () => {
    await delay(100);
  });

  const transforms: TransformDefinition[] = Object.values(BuiltInTransforms);
  for (const transform of transforms) {
    const libraryContainer = getByTestId('transform-library');
    const transformPlanContainer = getByTestId('transform-plan');
    const dropArea = within(transformPlanContainer).getByText('Drag in optional transforms');

    const libraryElement = within(libraryContainer).getByText(transform.name).closest('[draggable]') as HTMLElement;

    await act(async () => {
      await dragAndDrop(libraryElement, dropArea);
    });
    await act(async () => {
      await delay(2000);
    });

    if (isEmpty(transform.inputSchema)) {
      continue;
    }

    const modalRoot = canvasElement.ownerDocument.body.querySelector('#modal-root') as HTMLElement;
    if (modalRoot == null) throw new Error('Failed to find modal-root');
    const modal = within(modalRoot);

    switch (transform.id) {
      case BuiltInTransforms.ada_apply_mapping.id: {
        await act(async () => {
          const oldName = await modal.findByLabelText('Old name');
          await userEvent.type(oldName, 'OLD_NAME', { delay: 10 });
        });
        await act(async () => {
          const newName = await modal.findByLabelText('New name');
          await userEvent.type(newName, 'NEW_NAME', { delay: 10 });
        });
        await selectOptionEvent(modalRoot, 'New type', 'string');
        break;
      }
      case BuiltInTransforms.ada_drop_fields.id: {
        // defined options
        await act(async () => {
          await multiselectOptionEvent(modalRoot, 'Fields to drop', 'NEW_NAME');
        });
        // freeSolo
        await act(async () => {
          const field = await modal.findByLabelText('Fields to drop');
          await userEvent.type(field, 'DROP_ME{enter}', { delay: 10 });
        });
        break;
      }
      case BuiltInTransforms.ada_select_fields.id: {
        // defined options
        await act(async () => {
          await multiselectOptionEvent(modalRoot, 'Fields to select', 'NEW_NAME');
        });
        // freeSolo
        await act(async () => {
          const field = await modal.findByLabelText('Fields to select');
          await userEvent.type(field, 'SELECT_ME{enter}', { delay: 10 });
        });
        break;
      }
    }
    await act(async () => {
      userEvent.click(modal.getByText('Submit'));
    });

    await act(async () => {
      await delay(1000);
    });
  }
};

function getElementClientCenter(element: HTMLElement) {
  const { left, top, width, height } = element.getBoundingClientRect();
  return {
    x: left + width / 2,
    y: top + height / 2,
  };
}

const getCoords = (element: HTMLElement) => getElementClientCenter(element);

async function dragAndDrop(source: HTMLElement, target: HTMLElement, steps = 10, duration = 200) {
  await act(async () => {
    const from = getElementClientCenter(source);
    const to = getCoords(target);

    const step = {
      x: (to.x - from.x) / steps,
      y: (to.y - from.y) / steps,
    };

    const current = {
      clientX: from.x,
      clientY: from.y,
    };

    fireEvent.mouseEnter(source, current);
    fireEvent.mouseOver(source, current);
    fireEvent.mouseMove(source, current);
    fireEvent.mouseDown(source, current);
    for (let i = 0; i < steps; i++) {
      current.clientX += step.x;
      current.clientY += step.y;
      await delay(duration / steps);
      fireEvent.mouseMove(source, current);
    }

    fireEvent.mouseUp(source, current);
  });
}
