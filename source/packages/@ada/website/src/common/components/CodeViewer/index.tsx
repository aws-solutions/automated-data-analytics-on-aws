/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import AceEditor, { IAceEditorProps } from 'react-ace';
import React from 'react';
import clsx from 'clsx';

import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-sql';
import 'ace-builds/src-noconflict/theme-tomorrow';
import { createStyles } from '@material-ui/core';
import { isEmpty } from '@aws-amplify/core';
import { makeStyles } from 'aws-northstar';

const DEFAULT_PROPS: Partial<IAceEditorProps> = {
  readOnly: true,
  maxLines: 2,
  minLines: 1,
  highlightActiveLine: false,
  focus: false,
  wrapEnabled: true,
  showGutter: false,
  showPrintMargin: false,
  scrollMargin: [0],
  tabSize: 0,
};

export interface CodeViewerProps extends Omit<IAceEditorProps, 'width' | 'height'> {
  readonly mode: 'sql' | 'python';
  disableSelection?: boolean;
  width?: number | string;
  height?: number | string;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  disableSelection,
  value,
  width = '100%',
  height = '100%',
  className,
  ...props
}) => {
  props = {
    ...DEFAULT_PROPS,
    ...props,
  };

  const classes = useStyles();

  className = clsx(classes.editor, disableSelection ? classes.noSelect : {}, className);
  value = value ? value.trim() : value;

  if (value == null || isEmpty(value)) {
    return null;
  }

  return (
    // <Box className={classes.root} style={{ width, height }}>
    <AceEditor
      theme="tomorrow"
      className={className}
      {...props}
      value={value}
      width={parseCssLength(width)}
      height={parseCssLength(height)}
    />
    // </Box>
  );
};

function parseCssLength(length: string | number): string {
  if (typeof length === 'number') return `${length}px`;
  return length;
}

const useStyles = makeStyles(() =>
  createStyles({
    root: {
      display: 'flex',
      alignItems: 'stretch',
      justifyContent: 'stretch',
      flexDirection: 'column',
      flex: 1,
      alignSelf: 'stretch',
      justifySelf: 'stretch',
      minWidth: 200,
      minHeight: 30,
      overflow: 'visible',
    },
    editor: {
      width: '100%',
      height: '100%',
      flex: 1,
      alignSelf: 'stretch',
      justifySelf: 'stretch',
    },
    noSelect: {
      // maxWidth: 345,
      '& *': {
        userSelect: 'none',
      },
      '& .ace_scroller': {
        cursor: 'initial',
      },
      '& .ace_marker-layer .ace_selection': {
        userSelect: 'none !important',
        backgroundColor: 'transparent',
      },
      '& .ace_cursor': {
        userSelect: 'none !important',
        color: 'transparent',
      },
    },
  }),
);
