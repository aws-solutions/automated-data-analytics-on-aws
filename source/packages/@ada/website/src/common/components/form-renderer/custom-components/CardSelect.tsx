/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CardContent } from '@material-ui/core';
import { FormField, NORTHSTAR_COLORS, Text, Theme, makeStyles } from 'aws-northstar';
import { getDataEqualityHash } from '$common/utils';
import { v4 as uuid } from 'uuid';
import Card from '@material-ui/core/Card';
import CardHeader from '@material-ui/core/CardHeader';
import Grid, { GridProps } from '@material-ui/core/Grid';
import React, { ReactNode, useMemo } from 'react';
import useFieldApi from '@data-driven-forms/react-form-renderer/use-field-api';

export interface CardSelectOption {
  value: string;
  title?: string | ReactNode;
  subtitle?: string | ReactNode;
  icon?: string | ReactNode;
  content?: ReactNode;
}

export const DEFAULT_GRID_CONTAINER_PROPS: GridProps = {
  spacing: 2,
  direction: 'row',
  alignItems: 'stretch',
  // @ts-ignore
  justifyContent: 'flex-start',
}

export const DEFAULT_GRID_ITEM_PROPS: GridProps = {
  sm: 12,
  md: 6,
  lg: 4,
  xl: 3,
}

export interface CardSelectProps {
  /**
   * The name of the control used in HTML forms.
   * */
  name: string;
  /**
   * Allows you to indicate that the control is to be focused as soon as the load event triggers,
   *  allowing the user to just start typing without having to manually focus the input.
   * Don't use this option in pages that allow for the field to be scrolled out of the viewport.
   * */
  autofocus?: boolean;
  /**
   * Id of the internal input.<br/>
   * Use in conjunction with Form Field to relate a label element "for" attribute to this control for better web accessibility.
   * See example in <a href='/#/Components/FormField'>FormField</a> for more details.
   * */
  controlId?: string;
  /**
   * Adds an aria-label on the native input.
   * */
  label?: string;
  /**
   * Adds aria-labelledby on the native input. <br/>
   * Use this only with form fields that contain multiple controls under the same label.<br/>
   * Define a custom id inside the label.<br/>
   * Refer to that label from every single control under that label using this property.
   * */
  ariaLabelledby?: string;
  /**
   * Adds aria-describedby on the native input. <br/>
   * Use this only with form fields that contain multiple controls under the same label. <br/>
   * Define custom ids inside the description, hint and error text. <br/>
   * Refer to these from every single control under that label using this property.<br/>
   * Refer to any other hint/description text that you provide.
   * */
  ariaDescribedby?: string;
  /**
   * Adds aria-required on the native input
   * */
  ariaRequired?: boolean;

  /**
   * Items to displays for selections
   */
  options: CardSelectOption[];

  gridContainer?: GridProps;
  gridItem?: GridProps;

  isReadOnly?: boolean;
}

const useStyles = makeStyles<Theme>(() => ({
  card: {
    flex: 'auto',
    height: '100%',
    margin: 'auto',
    '&:hover': {
      cursor: 'pointer',
    },
  },
  avatar: {
    backgroundColor: 'white',
  },
}));

export const CardSelect: React.FC<CardSelectProps> = ({
  gridContainer: _gridContainerProps,
  gridItem: _gridItemProps,
  ...props
}) => {
  const {
    label,
    description,
    helperText,
    input,
    validateOnMount,
    stretch,
    showError,
    renderReload,
    onReloadClick,
    createNewLinkHref,
    createNewLink,
    secondaryControl,
    meta: { error, submitFailed },
    isReadOnly,
  } = useFieldApi(props);

  const styles = useStyles();

  const gridContainerProps = useMemo(() => {
    return {
      ...DEFAULT_GRID_CONTAINER_PROPS,
      ..._gridContainerProps,
    }
  }, [getDataEqualityHash(_gridContainerProps)]);

  const gridItemrProps = useMemo(() => {
    return {
      ...DEFAULT_GRID_ITEM_PROPS,
      ..._gridItemProps,
    }
  }, [getDataEqualityHash(_gridItemProps)]);

  const controlId = input.name || uuid();
  const errorText = ((validateOnMount || submitFailed || showError) && error) || '';
  return (
    <FormField
      controlId={controlId}
      label={label}
      description={description}
      hintText={helperText}
      errorText={errorText}
      stretch={stretch}
      secondaryControl={secondaryControl}
      renderReload={renderReload}
      onReloadClick={onReloadClick}
      createNewLink={createNewLink}
      createNewLinkHref={createNewLinkHref}
    >
      <Grid container {...gridContainerProps}>
        {props.options.map((option) => (
          <Grid item key={option.value} {...gridItemrProps}>
            <Card
              data-value={option.value}
              data-testid={`card-select-${option.value}`}
              className={styles.card}
              style={{
                backgroundColor: input.value === option.value ? NORTHSTAR_COLORS.BLUE_LIGHT : 'inherit',
              }}
              onClick={
                isReadOnly
                  ? undefined
                  : () => {
                      input.onChange({ target: { value: option.value } });
                    }
              }
            >
              <CardHeader title={option.title} subheader={option.subtitle} avatar={option.icon} />
              {option.content && (
                <CardContent>
                  {typeof option.content === 'string' ? <Text variant="p">{option.content}</Text> : option.content}
                </CardContent>
              )}
            </Card>
          </Grid>
        ))}
      </Grid>
    </FormField>
  );
};
