/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Ace } from 'ace-builds';
import AceEditor from 'react-ace';

import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-sql';
import 'ace-builds/src-noconflict/theme-tomorrow';
import { IAceEditor, IEditorProps } from 'react-ace/lib/types';
import { addCompleter } from 'ace-builds/src-noconflict/ext-language_tools';
import ReactAce from 'react-ace/lib/ace';

export interface CodeEditorProps {
  readonly mode: 'sql' | 'python';
  /** Default value for "uncontrolled" editor - only set initially */
  readonly defaultValue?: string;
  /** Value for "controlled" editor - change this value will update the editor */
  readonly value?: string;
  readonly onChange: (value: string) => void;
  readonly onFocus?: (event: any, editor?: Ace.Editor | undefined) => void;
  readonly onBlur?: (event: any, editor?: Ace.Editor | undefined) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly maxLines?: number;
  /** Zoom factor for editor text. */
  readonly zoom?: number;
  readonly commands?: Ace.Command[];

  /** Custom autocomplete completions. @memoize */
  readonly completions?: Ace.Completion[];
}

export const CodeEditor = React.forwardRef<IAceEditor | null, CodeEditorProps>(
  (
    {
      mode,
      disabled,
      defaultValue,
      value,
      placeholder,
      maxLines,
      onChange,
      onFocus,
      onBlur,
      zoom = 1,
      completions,
      commands,
    },
    ref,
  ) => {
    const [minLines] = useState<number>(() => {
      return Math.max(5, (defaultValue || '').split('\n').length);
    });

    const reactAceRef = useRef<ReactAce | null>(null);
    const editorRef = useRef<IAceEditor | null>(null);
    const setEditorRef = useCallback(
      (instance: ReactAce | null) => {
        reactAceRef.current = instance;
        editorRef.current = instance && instance.editor;
        if (ref) {
          if (typeof ref === 'function') {
            ref(editorRef.current);
          } else {
            ref.current = editorRef.current;
          }
        }

        if (commands) {
          editorRef?.current?.commands.addCommands(commands);
        }
        instance?.editor.container.querySelector('textarea')?.setAttribute('data-testid', `${mode}-editor-input`);
      },
      [editorRef, ref],
    );

    const editorProps = useMemo<IEditorProps>(() => {
      return {
        $blockScrolling: true,
      };
    }, []);

    // https://github.com/securingsincity/react-ace/issues/338
    useEffect(() => {
      if (completions) {
        const customCompleter: Ace.Completer = {
          getCompletions: (_editor, _session, _position, _prefix, callback) => {
            callback(null, completions);
          },
        };
        addCompleter(customCompleter);
      }
    }, [completions]);

    if (defaultValue != null && value != null) {
      throw new Error(
        'CodeEditor props `defaultValue` and `value` are mutually exclusive - either uncontrolled or controlled respectively.',
      );
    }

    return (
      <AceEditor
        ref={setEditorRef}
        name={`${mode}-editor`}
        mode={mode}
        theme="tomorrow"
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        defaultValue={defaultValue}
        value={value}
        readOnly={disabled}
        width="100%"
        height="100%"
        maxLines={maxLines || 30}
        minLines={minLines}
        placeholder={placeholder}
        fontSize={`${zoom}em`}
        editorProps={editorProps}
        enableBasicAutocompletion
        enableLiveAutocompletion
      />
    );
  },
);

export const SqlEditor = React.forwardRef<IAceEditor | null, Omit<CodeEditorProps, 'mode'>>((props, ref) => (
  <CodeEditor ref={ref} {...props} mode="sql" />
));

export const PythonEditor = React.forwardRef<IAceEditor | null, Omit<CodeEditorProps, 'mode'>>((props, ref) => (
  <CodeEditor ref={ref} {...props} mode="python" />
));
