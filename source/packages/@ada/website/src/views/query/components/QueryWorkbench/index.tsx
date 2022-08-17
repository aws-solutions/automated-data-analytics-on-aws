/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Box, Theme, makeStyles } from 'aws-northstar';
import { QueryWorkbenchDrawer as Drawer } from './Drawer';
import { QueryEditor } from './QueryEditor';
import { QueryResultPanel } from './QueryResultPanel';
import { QueryWorkbenchProvider, useQueryWorkbench } from './context';
import { isEmpty } from 'lodash';
import { parse as parseQueryString } from 'query-string';
import React, { useEffect } from 'react';

export interface QueryWorkbenchProps {}

export const QueryWorkbench: React.FC<QueryWorkbenchProps> = ({ children, ...props }) => {
  return (
    <QueryWorkbenchProvider>
      <BaseQueryWorkbench {...props}>{children}</BaseQueryWorkbench>
    </QueryWorkbenchProvider>
  );
};

const BaseQueryWorkbench: React.FC<QueryWorkbenchProps> = () => {
  const { isDrawerOpen, layout, setQuery } = useQueryWorkbench();

  // on mount check for "query" query string param and set it if exists
  useEffect(() => {
    // remove the leading ? mark
    const { query } = parseQueryString(window.location.search);
    if (query != null && !isEmpty(query)) {
      setQuery(String(query).trim());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isFullscreenResults = layout === 'fullscreen:results';

  const classes = useStyles({
    isSidebarOpen: true, // TODO: make persistent
    isFullscreenResults,
  });

  return (
    <Box className={classes.root}>
      {isDrawerOpen && !isFullscreenResults && <Drawer />}
      <Box className={classes.main}>
        {!isFullscreenResults && (
          <Box className={classes.editor}>
            <QueryEditor />
          </Box>
        )}
        <Box className={classes.results}>
          <QueryResultPanel />
        </Box>
      </Box>
    </Box>
  );
};

interface StyleProps {
  isSidebarOpen: boolean;
  isFullscreenResults: boolean;
}

const useStyles = makeStyles<Theme, StyleProps>((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'row',
    flex: 1,
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    flex: 1,
    justifySelf: 'stretch',
    alignSelf: 'stretch',
    boxSizing: 'border-box',
    padding: theme.spacing(2),
  },
  editor: {
    flex: 0,
    maxHeight: '60%',
    minHeight: 'initial !important',
  },
  results: {
    flex: 1,
    // do not collapse white space for results
    whiteSpace: 'pre-wrap',
  },
}));
