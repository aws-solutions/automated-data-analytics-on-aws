/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import { ComponentMeta, ComponentStory } from '@storybook/react';
import { DELAY } from '$testing/interaction';
import { FormData } from '../../utils';
import { FormRenderer } from 'aws-northstar';
import { LL } from '@ada/strings';
import { Schema, componentTypes } from 'aws-northstar/components/FormRenderer';
import { SchemaPreviewStep } from '.';
import { act } from '@testing-library/react';
import { delay } from '$common/utils';
import { useCallback, useMemo } from 'react';
import { userEvent, within } from '@storybook/testing-library';

export default {
  title: 'Views/DataProduct/Create/SchemaPreviewStep',
  component: SchemaPreviewStep,
} as ComponentMeta<typeof SchemaPreviewStep>;

const Template: ComponentStory<typeof SchemaPreviewStep> = () => {
  const formSchema = useMemo<Schema>(() => {
    return {
      fields: [
        {
          component: componentTypes.CUSTOM,
          name: 'inferredSchema',
          CustomComponent: (props: any) => <SchemaPreviewStep {...props} />,
        },
      ],
    };
  }, []);

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
  const { getByText } = within(canvasElement);

  // ensure state is fully resolved
  await act(async () => {
    await delay(DELAY.MEDIUM);
  });

  await act(async () => {
    userEvent.click(getByText(LL.VIEW.DATA_PRODUCT.SAMPLE.button.text()))
  })

  await act(async () => {
    await delay(DELAY.SHORT);
  });

  await act(async () => {
    userEvent.click(within(canvasElement.ownerDocument.body).getByText(LL.VIEW.DATA_PRODUCT.SAMPLE.WARNING.agreeText()))
  })

  await act(async () => {
    userEvent.click(within(canvasElement.ownerDocument.body).getByLabelText('close'))
  })
};
