/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Box, Button, Container, Inline, LoadingIndicator, makeStyles } from 'aws-northstar';
import { SaveQueryDialog } from '../SaveQueryDialog';
import { SqlEditor } from '$common/components/query';
import { createStyles } from '@material-ui/core';
import { isEmpty } from 'lodash';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useOperationAllowed } from '$api/hooks/permissions';
import { useQueryWorkbench } from '../context';
import { useSqlCompletions } from '../../../hooks/use-sql-completions';
import BookmarksIcon from '@material-ui/icons/Bookmarks';
import React, { useCallback, useMemo, useState } from 'react';

export const QueryEditor: React.FC<{}> = () => {
  const { LL } = useI18nContext();
  const { toggleDrawer, isExecutingQuery, getQuery, setQuery, editorRef, startQuery, cancelQuery, isDrawerOpen } =
    useQueryWorkbench();

  const query = getQuery();
  const [isSaveQueryDialogShown, setIsSaveQueryDialogShown] = useState<boolean>(false);
  const openSaveQueryDialog = useCallback(() => setIsSaveQueryDialogShown(true), [setIsSaveQueryDialogShown]);
  const closeSaveQueryDialog = useCallback(() => setIsSaveQueryDialogShown(false), [setIsSaveQueryDialogShown]);

  const allowSaveQuery = useOperationAllowed('putQuerySavedQuery') && !isEmpty(query);

  const onChange = useCallback(
    (_query: string) => {
      setQuery(_query, true); // indicate fromEditor so not recursive
    },
    [setQuery],
  );

  const completions = useSqlCompletions();

  const commands = [
    {
      name: 'execute',
      bindKey: { win: 'Ctrl-Enter', mac: 'Command-Enter' },
      exec: function () {
        if (!isExecutingQuery) startQuery();
      },
    },
  ];

  const styles = useStyles();

  const actionGroup = useMemo<React.ReactNode>(() => {
    let queryAction: React.ReactNode;
    if (isExecutingQuery) {
      queryAction = (
        <Button onClick={cancelQuery} label={LL.VIEW.QUERY.ACTIONS.cancel.label()}>
          <LoadingIndicator size="normal" label={LL.VIEW.QUERY.ACTIONS.cancel.text()} />
        </Button>
      );
    } else {
      queryAction = (
        <Button variant="primary" label={LL.VIEW.QUERY.ACTIONS.execute.label()} onClick={startQuery}>
          {LL.VIEW.QUERY.ACTIONS.execute.text()}
        </Button>
      );
    }

    return (
      <Inline>
        <BookmarksIcon onClick={toggleDrawer} color={isDrawerOpen ? 'disabled' : undefined} />
        <Button
          variant="normal"
          onClick={openSaveQueryDialog}
          disabled={!allowSaveQuery}
          label={LL.VIEW.QUERY.ACTIONS.save.label()}
        >
          {LL.VIEW.QUERY.ACTIONS.save.text()}
        </Button>

        {queryAction}
      </Inline>
    );
  }, [isExecutingQuery, startQuery, cancelQuery, allowSaveQuery, openSaveQueryDialog, toggleDrawer, isDrawerOpen]);

  return (
    <Container title={LL.VIEW.QUERY.title()} subtitle={LL.VIEW.QUERY.subtitle()} actionGroup={actionGroup}>
      <Box className={isExecutingQuery ? styles.disabled : undefined}>
        <SqlEditor
          ref={editorRef}
          // NOTE: disabled uses ace.readOnly which seems to get stuck and prevent editor for interim period
          // not really meant to be toggled, more of static value to set
          // disabled={isExecutingQuery}
          defaultValue={query}
          onChange={onChange}
          zoom={1.25}
          completions={completions}
          commands={commands}
        />
      </Box>

      {isSaveQueryDialogShown && <SaveQueryDialog onClose={closeSaveQueryDialog} />}
    </Container>
  );
};

const useStyles = makeStyles(() =>
  createStyles({
    // prevent editing query while execution
    disabled: {
      pointerEvents: 'none',
      opacity: 0.8,
      filter: 'brightness(0.9)',
    },
  }),
);
