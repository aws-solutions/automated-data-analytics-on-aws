/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { FieldArray as FieldArrayBase } from '@data-driven-forms/react-form-renderer';
import { getErrorText } from 'aws-northstar/components/FormRenderer/utils/getErrorText';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import Button from 'aws-northstar/components/Button';
import Container from 'aws-northstar/layouts/Container';
import FieldArrayItem from './components/FieldArrayItem';
import FormField from 'aws-northstar/components/FormField';
import React, { FunctionComponent } from 'react';
import Stack from 'aws-northstar/layouts/Stack';
import Text from 'aws-northstar/components/Text';
import useFieldApi, { UseFieldApiConfig } from '@data-driven-forms/react-form-renderer/use-field-api';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import useUniqueId from 'aws-northstar/hooks/useUniqueId';

// @jerjonas - only change is to override FieldArrayItem to enable flat array list (no nested objects if name is not present)

const DEFAULT_BUTTON_LABELS = {
  add: 'Add new item',
  remove: 'Remove',
};

const useStyles = makeStyles({
  grid: {
    marginTop: '-10px',
    '&>*': {
      marginTop: '10px',
    },
  },
});

const FieldArrayMapping: FunctionComponent<UseFieldApiConfig> = (props) => {
  const {
    arrayValidator,
    label,
    description,
    helperText,
    fields: formFields,
    // defaultItem = {},
    // @jerjonas - default to null to support flat array list - data-forms will auto map to object based on nested form fields
    defaultItem = null,
    showError,
    meta: { submitFailed, error },
    layout,
    displayLablePerItem = false,
    minItems = 0,
    maxItems = Number.MAX_SAFE_INTEGER,
    buttonLabels,
    renderContainer = false,
    noItemsMessage,
    validateOnMount,
    input,
    isReadOnly = false,
    ...rest
  } = useFieldApi(props);
  const controlId = useUniqueId(input.name);
  const errorText = getErrorText(validateOnMount, submitFailed, showError, error);
  const renderedButtonLabels = { ...DEFAULT_BUTTON_LABELS, ...buttonLabels };
  const theme = useTheme();
  const matched = useMediaQuery(theme.breakpoints.down('xs'));
  const styles = useStyles();

  const testId = rest['data-testid'] || 'form-array';

  return (
    <FormField
      controlId={controlId}
      label={label}
      description={description}
      hintText={helperText}
      errorText={errorText}
      data-testid={testId}
    >
      <FieldArrayBase key={controlId} name={controlId} validate={arrayValidator}>
        {({ fields }) => {
          const { length, map, push, remove } = fields;
          return (
            <Stack spacing="s">
              {length === 0 && <Text>{noItemsMessage}</Text>}
              {map((name: string, index: number) => {
                const item = (
                  <FieldArrayItem
                    gridStyle={styles.grid}
                    layout={layout}
                    key={`Item-${name}`}
                    fields={formFields}
                    name={name}
                    fieldIndex={index}
                    showError={showError}
                    displayLablePerItem={displayLablePerItem}
                    onRemove={remove}
                    length={length}
                    minItems={minItems}
                    removeLabel={renderedButtonLabels.remove}
                    isReadOnly={isReadOnly}
                    collapse={layout === 'stack' || matched}
                    data-testid={`${testId}-${name}`}
                  />
                );

                return renderContainer ? <Container key={`Container-${name}`}>{item}</Container> : item;
              })}
              {!isReadOnly && (
                <Button
                  onClick={() => push(defaultItem)}
                  disabled={!!length && length >= maxItems}
                  data-testid={`${testId}-add-button`}
                >
                  {renderedButtonLabels.add}
                </Button>
              )}
            </Stack>
          );
        }}
      </FieldArrayBase>
    </FormField>
  );
};

export default FieldArrayMapping;
