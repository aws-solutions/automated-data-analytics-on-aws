/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import FileUpload from 'aws-northstar/components/FileUpload';
import React, { useCallback } from 'react';

export interface FileUploadComponentProps {
  parseFileStructure: boolean;
  name: string;
  input: any;
  onChange: any;
  [key: string]: any;
}

export const FileUploadComponent = ({
  parseFileStructure = true,
  name,
  input,
  onChange,
  ...otherProps
}: FileUploadComponentProps) => {
  const handleOnChange = useCallback(
    async (files) => {
      if (files && files.length > 0) {
        if (onChange) {
          onChange(files);
          return;
        }

        if (parseFileStructure) {
          const content = await files[0].text();
          const { name: fileName, size, type } = files[0];

          input.onChange({ content, name: fileName, size, type });
          return;
        }

        input.onChange(files[0]);
      }
    },
    [input, onChange, parseFileStructure],
  );

  return <FileUpload controlId={name} onChange={handleOnChange} {...otherProps} />;
};
