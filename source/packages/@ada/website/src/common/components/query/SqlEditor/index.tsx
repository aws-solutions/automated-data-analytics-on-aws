/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import React from 'react';

import { CodeEditor, CodeEditorProps } from '$common/components/CodeEditor';
import { IAceEditor } from 'react-ace/lib/types';

export const SqlEditor = React.forwardRef<IAceEditor | null, Omit<CodeEditorProps, 'mode'>>((props, ref) => (
  <CodeEditor ref={ref} {...props} mode="sql" />
));
