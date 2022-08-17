/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CUSTOM_FIELDS, CUSTOM_WIDGETS } from '../../jsonschema-form';
import { DraggableResolvedTransform } from '../../types';
import { ISubmitEvent, UiSchema, withTheme } from '@rjsf/core';
import { Inline, Link, Stack, Text } from 'aws-northstar';
import { Modal } from '$northstar-plus';
import { Theme } from '@rjsf/material-ui/dist/v4';
import { TransformSchema } from '@ada/transforms';
import { extractUiSchema } from '../../utils';
import { useTransformPlannerContext } from '../../context';
import React, { useCallback, useMemo, useState } from 'react';

const UISCHEMA_DEFAULTS: UiSchema = {
  'ui:description': 'Define the input parameters for this transform in the form below.',
};

Theme.fields = {
  ...Theme.fields,
  ...CUSTOM_FIELDS,
};

Theme.widgets = {
  ...Theme.widgets,
  ...CUSTOM_WIDGETS,
};

// Memoize JsonSchemaForm to prevent reset issues during equal state updates
const JsonSchemaForm = React.memo(withTheme(Theme));

export interface TransformArgsDialogProps {
  index: number;
  transform: DraggableResolvedTransform;
  onCancel: () => void;
  onSave: (index: number, transform: DraggableResolvedTransform) => void;
}

export const TransformArgsDialog: React.FC<TransformArgsDialogProps> = ({ index, transform, onCancel, onSave }) => {
  const { emitter } = useTransformPlannerContext();
  const [inputArgs] = useState(transform.inputArgs || {});
  const [inputSchema] = useState<TransformSchema>(transform.script.inputSchema!);
  const uiSchema = useMemo<UiSchema>(() => {
    return inputSchema ? extractUiSchema(inputSchema, UISCHEMA_DEFAULTS) : {};
  }, [inputSchema]);

  const submitHandler = useCallback(
    async ({ formData: _inputArgs }: ISubmitEvent<object>) => {
      onSave(index, {
        ...transform,
        inputArgs: _inputArgs,
      });
      // Let custom field handlers know form was submitted so they can
      // register field updates to context.
      emitter.emit('SubmitInputArgs');
    },
    [index, transform, onSave, emitter],
  );

  const subtitle = useMemo<React.ReactNode>(() => {
    if (transform.script.helperText) {
      if (transform.script.helperText.startsWith('https://')) {
        return (
          <Inline spacing="s">
            <Text variant="small" color="textSecondary">
              {transform.script.description}
            </Text>
            <Link href={transform.script.helperText} forceExternal target="_blank">
              Info
            </Link>
          </Inline>
        );
      } else {
        return (
          <Stack spacing="s">
            <Text variant="small" color="textSecondary">
              {transform.script.description}
            </Text>
            <Text variant="small" color="textSecondary">
              {transform.script.helperText}
            </Text>
          </Stack>
        );
      }
    } else {
      return (
        <Text variant="small" color="textSecondary">
          {transform.script.description}
        </Text>
      );
    }
  }, [transform.script]);

  return (
    <Modal title={transform.script.name} subtitle={subtitle as string} visible onClose={onCancel} width="60%">
      <JsonSchemaForm formData={inputArgs} schema={inputSchema} uiSchema={uiSchema} onSubmit={submitHandler} />
    </Modal>
  );
};
