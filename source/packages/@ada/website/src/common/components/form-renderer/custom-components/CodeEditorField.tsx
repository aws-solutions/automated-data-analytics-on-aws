/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CodeEditor, CodeEditorProps } from '$common/components/CodeEditor';
import { FormField } from 'aws-northstar';
import { throttle } from 'lodash';
import { useFormApi } from '@data-driven-forms/react-form-renderer';
import { v4 as uuid } from 'uuid';
import React, { useMemo } from 'react';
import useFieldApi from '@data-driven-forms/react-form-renderer/use-field-api';

export interface CodeEditorFieldProps {
  /**
   * The name of the control used in HTML forms.
   * */
  name: string;
  /**
   * Allows you to indicate that the control is to be focused as soon as the load event triggers,
   *  allowing the user to just start typing without having to manually focus the input.
   * Don't use this option in pages that allow for the field to be scrolled out of the viewport.
   * */
  autofocus?: boolean;
  /**
   * Id of the internal input.<br/>
   * Use in conjunction with Form Field to relate a label element "for" attribute to this control for better web accessibility.
   * See example in <a href='/#/Components/FormField'>FormField</a> for more details.
   * */
  controlId?: string;
  /**
   * Adds an aria-label on the native input.
   * */
  label?: string;
  /**
   * Adds aria-labelledby on the native input. <br/>
   * Use this only with form fields that contain multiple controls under the same label.<br/>
   * Define a custom id inside the label.<br/>
   * Refer to that label from every single control under that label using this property.
   * */
  ariaLabelledby?: string;
  /**
   * Adds aria-describedby on the native input. <br/>
   * Use this only with form fields that contain multiple controls under the same label. <br/>
   * Define custom ids inside the description, hint and error text. <br/>
   * Refer to these from every single control under that label using this property.<br/>
   * Refer to any other hint/description text that you provide.
   * */
  ariaDescribedby?: string;
  /**
   * Adds aria-required on the native input
   * */
  ariaRequired?: boolean;

  isReadOnly?: boolean;

  mode: CodeEditorProps['mode'];

  defaultValue?: string;

  maxLines?: number;
}

export const CodeEditorField: React.FC<CodeEditorFieldProps> = ({
  mode,
  defaultValue,
  maxLines,
  ...fieldProps
}: CodeEditorFieldProps) => {
  const {
    label,
    description,
    helperText,
    input,
    validateOnMount,
    stretch,
    showError,
    renderReload,
    onReloadClick,
    createNewLinkHref,
    createNewLink,
    secondaryControl,
    meta: { error, submitFailed },
    isReadOnly,
  } = useFieldApi(fieldProps);
  const formApi = useFormApi();

  const controlId = useMemo(() => input.name || uuid(), [input.name]);
  const errorText = ((validateOnMount || submitFailed || showError) && error) || '';

  const onChange = useMemo(() => {
    return throttle((value: string) => {
      formApi.change(input.name, value);
    }, 200);
  }, [formApi, input.name]);

  return (
    <FormField
      controlId={controlId}
      label={label}
      description={description}
      hintText={helperText}
      errorText={errorText}
      stretch={stretch}
      secondaryControl={secondaryControl}
      renderReload={renderReload}
      onReloadClick={onReloadClick}
      createNewLink={createNewLink}
      createNewLinkHref={createNewLinkHref}
    >
      <CodeEditor
        mode={mode}
        onChange={onChange}
        value={input.value || defaultValue}
        disabled={isReadOnly}
        onFocus={input.onFocus}
        onBlur={input.onBlur}
        maxLines={maxLines}
      />
    </FormField>
  );
};
