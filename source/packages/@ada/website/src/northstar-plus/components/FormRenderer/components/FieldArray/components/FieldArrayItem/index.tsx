/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Field } from '@data-driven-forms/react-form-renderer';
import Box from 'aws-northstar/layouts/Box';
import Button from 'aws-northstar/components/Button';
import ColumnLayout, { Column } from 'aws-northstar/layouts/ColumnLayout';
import Divider from '@material-ui/core/Divider';
import Grid from 'aws-northstar/layouts/Grid';
import InputLabel from '@material-ui/core/InputLabel';
import React, { FunctionComponent, ReactNode, useCallback, useMemo } from 'react';
import Stack from 'aws-northstar/layouts/Stack';
import Typography from '@material-ui/core/Typography';
import useFormApi from '@data-driven-forms/react-form-renderer/use-form-api';

// @jerjonas - only change is to support flat arrays (no nested objects if name is not present)

export interface FieldArrayItemProps {
  fields?: Field[];
  fieldIndex: number;
  name?: string;
  onRemove: (index: number) => void;
  length?: number;
  minItems?: number;
  removeLabel: string;
  showError?: boolean;
  isReadOnly: boolean;
  displayLablePerItem: boolean;
  layout?: 'grid' | 'column';
  collapse: boolean;
  gridStyle: string;
}

const FieldArrayItem: FunctionComponent<FieldArrayItemProps> = ({
  fields = [],
  fieldIndex,
  name,
  onRemove,
  removeLabel,
  showError,
  isReadOnly,
  layout,
  displayLablePerItem,
  collapse,
  gridStyle,
  ...props
}) => {
  const formOptions = useFormApi();

  // @jerjonas - only change is to not nest field key if name is not present
  const getFieldKey = useCallback((fieldName: string) => (fieldName ? `${name}.${fieldName}` : name), [name]);

  const editedFields = useMemo(() => {
    return fields.map((field) => {
      return {
        ...field,
        showError,
        name: getFieldKey(field.name),
        key: getFieldKey(field.name),
        stretch: true,
        label: (collapse || displayLablePerItem) && field.label,
        description: (collapse || displayLablePerItem) && field.description,
      };
    });
  }, [fields, showError, collapse, getFieldKey, displayLablePerItem]);

  // @ts-ignore
  const testId = props['data-testid'];

  const getBox = useCallback(
    (field: Field) => (
      <Box width="100%" pr={1}>
        {formOptions.renderForm([
          {
            ...field,
            'data-testid': `${testId}-${field.name}`,
          },
        ])}
      </Box>
    ),
    [formOptions, testId],
  );

  const getHeader = useCallback(
    (field: Field) => (
      <Box>
        {field.label && <InputLabel htmlFor={getFieldKey(field.name)}>{field.label}</InputLabel>}
        {field.description && (
          <Typography variant="subtitle1" component="div">
            {field.description}
          </Typography>
        )}
      </Box>
    ),
    [getFieldKey],
  );

  const renderRow = useCallback(
    (list: Field[], getContent: (field: Field) => ReactNode, isHeaderRow = false) => {
      const buttonBoxProps = isHeaderRow
        ? {
            visibility: 'hidden',
            height: '1px',
          }
        : collapse
        ? {
            display: 'flex',
            alignItems: 'center',
            'data-testid': `${testId}-remove-button`,
          }
        : {
            display: 'flex',
            alignItems: 'flex-start',
            pt: 0.3,
            'data-testid': `${testId}-remove-button`,
          };
      const getKey = (field: Field) => (isHeaderRow ? `${field.name}-header` : field.key);
      return (
        <Box>
          {fieldIndex !== 0 && collapse && <Divider orientation="horizontal" />}
          <Box display="flex">
            <Box flexGrow={1}>
              {collapse ? (
                <Stack spacing="xs">
                  {list.map((field) => (
                    <Box key={getKey(field)}>{getContent(field)}</Box>
                  ))}
                </Stack>
              ) : layout === 'grid' ? (
                <Grid container className={gridStyle}>
                  {list.map((field) => (
                    <Grid item key={getKey(field)} xs={field.column}>
                      {getContent(field)}
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <ColumnLayout renderDivider={false}>
                  {list.map((field) => (
                    <Column key={getKey(field)}>{getContent(field)}</Column>
                  ))}
                </ColumnLayout>
              )}
            </Box>
            {!isReadOnly && (
              <Box {...buttonBoxProps}>
                <Button
                  onClick={() => {
                    onRemove(fieldIndex);
                  }}
                >
                  {removeLabel}
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      );
    },
    [isReadOnly, removeLabel, onRemove, layout, collapse, fieldIndex, gridStyle, testId],
  );

  return (
    <div data-testid={testId}>
      {fieldIndex === 0 && !collapse && !displayLablePerItem && renderRow(fields, getHeader, true)}
      {/* @ts-ignore */}
      {renderRow(editedFields, getBox)}
    </div>
  );
};

export default FieldArrayItem;
