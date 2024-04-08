/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Theme, makeStyles } from 'aws-northstar';
import React from 'react';

const useStyles = makeStyles<Theme, { readonly?: boolean}>((theme) => ({
  input: ({ readonly }) => ({
    appearance: 'none',
    width: theme.spacing(2),
    height: theme.spacing(2),
    borderRadius: '100%',
    backgroundColor: theme.palette.grey[100],
    transition: 'background 300ms ease-in-out',
    outline: 'none',
    cursor: readonly ? undefined : 'pointer',
    margin: theme.spacing(0.4),
    padding: 0,

    "&:before": {
      position: "absolute",
      display: "block",
      fontSize: "10px",
      color: theme.palette.grey[900],
      padding: theme.spacing(0.2),
      borderRadius: theme.spacing(0.2),
      opacity: 0.5,
      willChange: "opacity, transform",
      transition: "opacity 150ms ease-in-out, transform 150ms ease-in-out",
      transform: 'translate(0, -20px)',
      content: 'attr(value) "%"',
    },

    "&:checked": {
      backgroundColor: readonly ? theme.palette.grey[900] : theme.palette.info.dark,

      "&:before": {
        opacity: 1,
        color: theme.palette.grey[100],
        backgroundColor: readonly ? theme.palette.grey[900] : theme.palette.info.dark,
      }
    }
  }),
}));

export interface CheckboxInputProps {
  name: string;
  value: number;
  checked: boolean;
  readonly?: boolean;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}

export const CheckboxInput: React.FC<CheckboxInputProps> = ({
  name,
  value,
  checked,
  readonly,
  onChange,
}) => {
  const styles = useStyles({ readonly });

  return (<input
    type="checkbox"
    name={name}
    onChange={onChange}
    value={value}
    checked={checked}
    readOnly={readonly}
    className={styles.input} />);
}
