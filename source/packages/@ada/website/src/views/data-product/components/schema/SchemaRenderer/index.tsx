/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Box, Paper, Theme, makeStyles } from 'aws-northstar';
import { DataProductEntity, DataProductIdentifier, DataProductPreview } from '@ada/api-client';
import { DatasetSchema, DatasetSchemaProps } from './components/DatasetSchema';
import { SampleDataDialog } from './components/SampleDataDialog';
import { SchemaMenu, SchemaMenuProps } from './components/SchemaMenu';
import {
  SchemaRendererProvider,
  useSchemaRenderer,
} from '$views/data-product/components/schema/SchemaRenderer/context';
import { createStyles } from '@material-ui/core';
import { dataProductIdentifier, getDataProductSQLIdentitier } from '$common/utils';
import React, { useEffect, useMemo, useState } from 'react';

export const IGNORE_WHILE_EDITING = 'Ignoring data product update while editing';

export interface SchemaRendererProps extends Omit<SchemaMenuProps, 'variant'> {
  readonly preview?: DataProductPreview;
  readonly entity?: DataProductEntity;
  readonly variant?: 'accordion';
}

const BaseSchemaRenderer: React.FC<SchemaRendererProps> = ({ preview, entity, variant, ...props }) => {
  const {
    loadDataProductEntity,
    loadDataProductPreview,
    dataset: activeDataset,
    totalDatasets,
    hasMultipleDatasets,
    sampleDataset,
    setSampleDataset,
    isEditMode,
  } = useSchemaRenderer();

  const previewJson = JSON.stringify(preview);
  const entityJson = JSON.stringify(entity);

  const [agreedPii, setAgreedPii] = useState(false);
  useEffect(() => {
    // do not update while editing as it blocks the UI and causes side effects with forms
    if (isEditMode) {
      console.info(IGNORE_WHILE_EDITING, preview, entity);
      return;
    }

    if (preview) {
      loadDataProductPreview(preview);
    } else if (entity) {
      loadDataProductEntity(entity);
    }
  }, [isEditMode, previewJson, entityJson, loadDataProductEntity, loadDataProductPreview]);

  const columns = useMemo<DatasetSchemaProps['columns']>(() => {
    if (preview) {
      return [];
    } else {
      return ['pii', 'ontology', 'description'];
    }
  }, [previewJson]);

  const classes = useStyles({ hasMultipleDatasets });

  if (totalDatasets === 0) {
    return <Box className={classes.root}>No datasets available</Box>;
  }

  if (variant === 'accordion') {
    return (
      <Box className={classes.accordionRoot}>
        <SchemaMenu variant="accordion" {...props} />

        {sampleDataset && (
          <SampleDataDialog
            table={sampleDataset}
            agreed={agreedPii}
            onClose={(agreed) => {
              setAgreedPii(!!agreed);
              setSampleDataset(undefined);
            }}
          />
        )}
      </Box>
    );
  } else {
    return (
      <Box className={classes.root}>
        {hasMultipleDatasets && (
          <Paper className={classes.sidebarContainer}>
            <SchemaMenu {...props} />
          </Paper>
        )}
        <Paper className={classes.contentContainer}>
          {activeDataset && <DatasetSchema dataset={activeDataset} columns={columns} />}
        </Paper>

        {sampleDataset && (
          <SampleDataDialog
            table={sampleDataset}
            agreed={agreedPii}
            onClose={(agreed) => {
              setAgreedPii(!!agreed);
              setSampleDataset(undefined);
            }}
          />
        )}
      </Box>
    );
  }
};

export const SchemaRenderer: React.FC<SchemaRendererProps> = (props) => {
  const { preview, entity } = props;

  if ((preview == null && entity == null) || (preview && entity)) {
    throw new Error('SchemaRenderer requires either `preview` or `entity` prop - mutually exclusive.');
  }

  const dataProductSqlIdentitier = entity && getDataProductSQLIdentitier(entity);
  const dataProductId = useMemo<DataProductIdentifier | undefined>(() => {
    return entity == null ? undefined : dataProductIdentifier(entity);
  }, [dataProductSqlIdentitier]);

  return (
    <SchemaRendererProvider dataProductId={dataProductId}>
      <BaseSchemaRenderer {...props} />
    </SchemaRendererProvider>
  );
};

interface StyleProps {
  hasMultipleDatasets: boolean;
}

const useStyles = makeStyles<Theme, StyleProps>((theme) =>
  createStyles({
    root: {
      display: 'flex',
      flexDirection: 'row',
      marginTop: theme.spacing(2),
    },
    accordionRoot: {
      flex: 1,
      overflow: 'auto',
      minHeight: 0,
    },
    sidebarContainer: {
      display: 'flex',
      flexDirection: 'column',
      flex: 0.2,
      background: theme.palette.common.white,
    },
    contentContainer: {
      display: 'flex',
      flexDirection: 'column',
      flex: ({ hasMultipleDatasets }) => (hasMultipleDatasets ? 0.8 : 1),
      background: theme.palette.common.white,
    },
  }),
);
