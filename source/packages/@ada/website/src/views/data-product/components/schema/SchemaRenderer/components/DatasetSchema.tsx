/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Box, Button, Inline, Stack, Theme, makeStyles } from 'aws-northstar';
import { FlexTable } from '$common/components';
import { NormalizedDatasetSchema, useSchemaRenderer } from '../context';
import { Skeletons } from '$northstar-plus/components/skeletons';
import { TableDefinitionOptions, useColumnDefinitions } from './column-definitions';
import { columnMetadataToList } from '$common/utils';
import { createStyles } from '@material-ui/core';
import { sortBy } from 'lodash';
import { useI18nContext } from '$strings';
import { useOpenInQueryWorkbench } from '$views/data-product/hooks';
import React, { ReactNode, useCallback, useMemo } from 'react';

export interface DatasetSchemaProps extends Pick<TableDefinitionOptions, 'columns' | 'variant'> {
  dataset?: NormalizedDatasetSchema;
}

export const DatasetSchema: React.FC<DatasetSchemaProps> = ({ dataset: datasetProp, columns, variant }) => {
  const { LL } = useI18nContext();
  const {
    isEditAllowed,
    isEditMode,
    enterEditMode,
    exitEditMode,
    resetDataset,
    saveDataset,
    isSaving,
    dataset: activeDataset,
    updateDatasetColumn: updateColumn,
    hasMultipleDatasets,
    setSampleDataset,
  } = useSchemaRenderer();
  // prioritize explicit dataset from props
  const dataset = datasetProp || activeDataset;

  const columnDefinitions = useColumnDefinitions(dataset?.columns, {
    variant,
    columns,
    updateColumn,
    isEditMode,
    isSaving,
  });
  const items = useMemo(() => {
    if (dataset) {
      return sortBy(columnMetadataToList(dataset.columns), ['sortOrder', 'name', 'id']);
    }
    return null;
  }, [JSON.stringify(dataset?.columns)]); // react-hooks/exhaustive-deps

  const cancelHandler = useCallback(() => {
    resetDataset();
    exitEditMode();
  }, [resetDataset, exitEditMode]);

  const saveHandler = useCallback(() => {
    saveDataset();
  }, [saveDataset]);

  const isQueryable = dataset?.queryable;
  const openInQueryWorkbench = useOpenInQueryWorkbench();

  const name =
    dataset == null
      ? LL.ENTITY.data_set()
      : dataset.isDefault
      ? LL.ENTITY.DataSet_.default()
      : LL.ENTITY.DataSet_.name({ name: dataset.name });

  const actionGroup = useMemo<ReactNode>(() => {
    const actions: React.ReactNode[] = [];

    if (dataset?.queryable) {
      actions.push(
        <Button
          key="query"
          label={LL.VIEW.DATA_PRODUCT.QUERY.button.label(dataset.name)}
          disabled={!dataset.isDataReady}
          onClick={() => openInQueryWorkbench(dataset.id)}
        >
          {LL.VIEW.DATA_PRODUCT.QUERY.button.text()}
        </Button>,
      );
    }

    if (dataset?.sample) {
      actions.push(
        <Button
          key="sample"
          label={LL.VIEW.DATA_PRODUCT.SAMPLE.button.label()}
          onClick={() => setSampleDataset(dataset)}
        >
          {LL.VIEW.DATA_PRODUCT.SAMPLE.button.text()}
        </Button>,
      );
    }

    if (dataset?.isEditable && isEditAllowed) {
      if (isEditMode) {
        actions.push(
          <Button key="edit-cancel" onClick={cancelHandler} disabled={isSaving}>
            {LL.VIEW.DATA_PRODUCT.SCHEMA.ACTION.cancel.text()}
          </Button>,
          <Button key="edit-save" variant="primary" loading={isSaving} disabled={isSaving} onClick={saveHandler}>
            {LL.VIEW.DATA_PRODUCT.SCHEMA.ACTION.save.text()}
          </Button>,
        );
      } else {
        actions.push(
          <Button key="edit" onClick={enterEditMode}>
            {LL.VIEW.DATA_PRODUCT.SCHEMA.ACTION.edit.text()}
          </Button>,
        );
      }
    }

    return <Inline>{actions}</Inline>;
  }, [
    isEditAllowed,
    isEditMode,
    enterEditMode,
    isSaving,
    saveHandler,
    cancelHandler,
    isQueryable,
    openInQueryWorkbench,
    JSON.stringify(dataset),
    name,
  ]);

  const classes = useStyles();

  if (dataset == null || columnDefinitions == null || items == null) {
    return <Skeletons.Table />;
  }

  if (variant === 'compact') {
    return (
      <Stack spacing="s">
        <FlexTable
          columnDefinitions={columnDefinitions}
          items={items}
          disableRowSelect
          disableExpand
          disableSettings
          disableFilters
          disablePagination
          disableColumnFilters
          preventVerticalScroll
        />
        {dataset?.sample && (
          <Box className={classes.compactTableActions}>
            <Button
              size="small"
              variant="link"
              label={LL.VIEW.DATA_PRODUCT.SAMPLE.button.label()}
              onClick={() => setSampleDataset(dataset)}
            >
              {LL.VIEW.DATA_PRODUCT.SAMPLE.button.text()}
            </Button>
          </Box>
        )}
      </Stack>
    );
  } else {
    return (
      <FlexTable
        tableTitle={hasMultipleDatasets !== true ? undefined : name}
        tableDescription={dataset.description}
        actionGroup={actionGroup}
        columnDefinitions={columnDefinitions}
        items={items}
        disableRowSelect
        disableExpand
        disableSettings
        disableFilters={!isEditMode}
        disablePagination
        disableColumnFilters
        preventVerticalScroll
      />
    );
  }
};

const useStyles = makeStyles<Theme>((theme) =>
  createStyles({
    compactTableActions: {
      textAlign: 'right',
      marginTop: -10, // odd margin at bottom of tables
      marginBottom: theme.spacing(1),
    },
  }),
);
