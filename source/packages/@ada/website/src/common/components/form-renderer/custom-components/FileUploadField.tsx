/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { FileMetadata } from 'aws-northstar/components/FileUpload/types';
import { isEmpty } from 'lodash';
import { useFormApi } from '@data-driven-forms/react-form-renderer';
import FileUpload, { FileUploadProps } from 'aws-northstar/components/FileUpload';
import React, { useCallback, useMemo } from 'react';
import useFieldApi from '@data-driven-forms/react-form-renderer/use-field-api';

type BaseFileUploadProps = Pick<FileUploadProps, 'accept' | 'multiple' | 'buttonText' | 'files'>;

export interface FileUploadFieldProps extends BaseFileUploadProps {
  /**
   * The name of the control used in HTML forms.
   * */
  name: string;

  /**
   * Save parsed file data (including content) as value rather than files.
   */
  parseFileStructure: boolean;

  /**
   * Name of form path to store "content" of file - only first file will be stored if multiple.
   */
  storeContentAs?: string;
}

export const FileUploadField: React.FC<FileUploadFieldProps> = ({
  accept,
  multiple,
  buttonText,
  files,
  parseFileStructure,
  storeContentAs,
  ...props
}) => {
  const fieldProps = useFieldApi(props);
  const formApi = useFormApi();
  const { validateOnMount, submitFailed, showError, error, input } = fieldProps;

  const errorText = ((validateOnMount || submitFailed || showError) && error) || '';

  const handleOnChange = useCallback<Required<FileUploadProps>['onChange']>(
    async (_files) => {
      if (parseFileStructure) {
        _files = await Promise.all(_files.map(parseFile));
      }

      if (multiple) {
        input.onChange(_files);
      } else {
        input.onChange(_files[0]);
      }

      if (storeContentAs) {
        let file = _files[0];
        if (file instanceof File) {
          file = await parseFile(file);
        }
        formApi.change(storeContentAs, (file as any).content);
      }
    },
    [formApi, input, parseFileStructure, multiple, storeContentAs],
  );

  const filesValue = useMemo(() => {
    const value = files || input.value;
    if (value == null || isEmpty(value)) return undefined;
    if (multiple) {
      return Array.isArray(value) ? value : [value];
    }
    return value;
  }, [files, input.value, multiple]);

  return (
    <FileUpload
      controlId={input.name}
      {...fieldProps}
      onChange={handleOnChange}
      errorText={errorText}
      files={filesValue}
      accept={accept}
      multiple={multiple}
      buttonText={buttonText}
    />
  );
};

async function parseFile(file: File | FileMetadata): Promise<FileMetadata & { content?: string }> {
  const { name, size, type } = file;
  const content = file instanceof File ? await file.text() : (file as any).content;

  return { name, size, type, content };
}
