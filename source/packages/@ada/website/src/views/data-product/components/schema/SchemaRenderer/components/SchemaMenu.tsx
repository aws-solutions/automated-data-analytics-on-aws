/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Box, LoadingIndicator, Theme, makeStyles } from 'aws-northstar';
import { Collapse, Divider, List, ListItem, ListItemText, createStyles } from '@material-ui/core';
import { DataSetIds } from '@ada/common';
import { DatasetSchema } from './DatasetSchema';
import { NORTHSTAR_COLORS } from '$core/theme';
import { NormalizedDatasetGroup, NormalizedDatasetSchema, useSchemaRenderer } from '../context';
import { isEmpty } from 'lodash';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import React, { Fragment, useCallback, useMemo, useState } from 'react';
import clsx from 'clsx';

export interface SchemaMenuProps {
  variant?: 'menu' | 'accordion';
  hideSource?: boolean;
  hideCurrent?: boolean;
  hideParentListItem?: boolean;
  tablePostfix?: string;
}

export const SchemaMenu: React.FC<SchemaMenuProps> = ({
  variant = 'menu',
  hideSource = false,
  hideCurrent = false,
  hideParentListItem = false,
  tablePostfix,
}) => {
  const { schema } = useSchemaRenderer();

  const classes = useStyles({
    compact: variant === 'accordion',
    nested: hideParentListItem !== true,
  });

  if (schema == null) {
    return null;
  }

  const renderSource = hideSource === false && schema.source != null && isEmpty(schema?.source?.datasets) === false;
  const renderCurrent = hideCurrent === false && schema.current != null && isEmpty(schema?.current?.datasets) === false;

  if (renderSource === false && renderCurrent === false) {
    return null;
  }

  return (
    <Box className={clsx(classes.root, variant)}>
      <List className={classes.list} component="nav">
        {renderSource && (
          <DatasetList
            variant={variant}
            {...schema.source!}
            hideParentListItem={hideParentListItem}
            tablePostfix={tablePostfix}
          />
        )}
        {renderSource && renderCurrent && <Divider />}
        {renderCurrent && (
          <DatasetList
            variant={variant}
            openOnMount
            collapsible={false}
            {...schema.current!}
            hideParentListItem={hideParentListItem}
            tablePostfix={tablePostfix}
          />
        )}
      </List>
    </Box>
  );
};

const DatasetList: React.FC<
  NormalizedDatasetGroup & {
    openOnMount?: boolean;
    collapsible?: boolean;
    variant: 'menu' | 'accordion';
    hideParentListItem?: boolean;
    tablePostfix?: string;
  }
> = ({
  title,
  datasets,
  ids,
  defaultId,
  openOnMount = false,
  collapsible,
  variant,
  hideParentListItem,
  tablePostfix,
}) => {
  const { LL } = useI18nContext();
  const { dataset: activeDataset, setDataset: setActiveDataset, isEditMode } = useSchemaRenderer();
  if (collapsible == null) {
    collapsible = ids.length > 1;
  }

  const defaultDataset = useMemo<NormalizedDatasetSchema | undefined>(() => {
    return datasets[defaultId];
  }, [datasets, defaultId]);

  const sortedDatasets = useMemo<NormalizedDatasetSchema[]>(() => {
    return ids.map((id) => datasets[id]);
  }, [datasets, ids]);
  const isSingleTable = sortedDatasets.length === 1;

  const [open, setOpen] = useState(openOnMount);

  const handleTitleClick = useCallback(
    (dataset: NormalizedDatasetSchema) => {
      if (collapsible) {
        if (!open) {
          setOpen(true);
          setActiveDataset(dataset);
        }
      } else {
        setActiveDataset(dataset);
      }
    },
    [setOpen, setActiveDataset, collapsible, open],
  );

  const handleDatasetClick = useCallback(
    (dataset: NormalizedDatasetSchema) => {
      setActiveDataset(dataset);
    },
    [setActiveDataset],
  );

  const isOpen = (collapsible === false && openOnMount) || open;

  const classes = useStyles({
    compact: variant === 'accordion',
    nested: hideParentListItem !== true,
  });

  if (defaultDataset == null) {
    return <LoadingIndicator size="normal" />;
  }

  if (isSingleTable) {
    return (
      <ListItem
        button
        selected={activeDataset?.id === defaultDataset.id}
        disabled={isEditMode}
        onClick={() => handleTitleClick(defaultDataset)}
        className={clsx(classes.listItem, 'singleTable')}
        title={defaultDataset.name}
      >
        {variant === 'accordion' ? (
          <DatasetSchema dataset={defaultDataset} variant="compact" />
        ) : (
          <ListItemText primary={title || defaultDataset.name} />
        )}
      </ListItem>
    );
  }

  return (
    <>
      {!hideParentListItem && (
        <ListItem
          button
          disabled={isEditMode}
          onClick={() => handleTitleClick(defaultDataset)}
          className={classes.listItem}
          title={defaultDataset.name}
        >
          <ListItemText primary={title || defaultDataset.name} />
          {collapsible && (isOpen ? <ExpandLess /> : <ExpandMore />)}
        </ListItem>
      )}
      <Collapse in={isOpen} timeout="auto" unmountOnExit>
        <List component="div" className={classes.list}>
          {sortedDatasets.map((table) => {
            const selected = activeDataset?.id === table.id;
            return (
              <Fragment key={table.id}>
                <ListItem
                  selected={selected}
                  button
                  disabled={isEditMode}
                  onClick={() => handleDatasetClick(table)}
                  className={classes.nestedListItem}
                  title={table.name}
                >
                  <ListItemText
                    primary={
                      (table.name === DataSetIds.DEFAULT ? LL.ENTITY.DataSet_.default() : table.name) +
                      (tablePostfix ? ` ${tablePostfix}` : '')
                    }
                  />
                  {hideParentListItem && (selected ? <ExpandLess /> : <ExpandMore />)}
                </ListItem>
                {selected && variant === 'accordion' && <DatasetSchema dataset={table} variant="compact" />}
              </Fragment>
            );
          })}
        </List>
      </Collapse>
    </>
  );
};

interface StyleProps {
  compact: boolean;
  nested: boolean;
}

const useStyles = makeStyles<Theme, StyleProps>((theme) =>
  createStyles({
    root: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',

      '& *': {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },

      '& .Mui-selected': {
        '& .MuiListItemText-primary': {
          fontWeight: 'bold',
          color: NORTHSTAR_COLORS.BLUE_DARK,
        },
      },
      '&.accordion': {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justiftyContent: 'stretch',
        padding: 0,

        '& .singleTable': {
          padding: 0,
          margin: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
        },

        '& nav': {
          flex: 1,
          padding: 0,
          margin: 0,
        },
      },
    },
    list: {
      background: 'transparent',
    },
    listItem: {
      padding: ({ compact }) => (compact ? theme.spacing(0.5) : theme.spacing(2)),
      // paddingBottom: ({ compact }) => compact ? theme.spacing(0.5) : theme.spacing(1),

      '& .MuiListItemText-primary': {
        fontWeight: 'bold',
      },
    },
    nestedListItem: {
      padding: ({ compact }) => (compact ? theme.spacing(0.2) : theme.spacing(1)),
      paddingLeft: ({ compact, nested }) => (compact ? theme.spacing(nested ? 2 : 1) : theme.spacing(nested ? 4 : 2)),
      backgroundColor: ({ compact }) => (compact ? theme.palette.background.default : undefined),
      borderBottom: ({ compact }) => (compact ? `1px solid ${theme.palette.grey[400]}` : undefined),

      '& .MuiListItemText-primary': {
        fontWeight: ({ nested }) => (nested ? undefined : 'bold'),
        color: ({ nested }) => (nested ? undefined : theme.palette.grey[600]),
      },
    },
  }),
);
