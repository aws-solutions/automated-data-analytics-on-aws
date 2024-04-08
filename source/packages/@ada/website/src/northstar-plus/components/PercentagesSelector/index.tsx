/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Box, makeStyles } from 'aws-northstar';
import { CheckboxInput } from './components/CheckboxInput';
import { isEqual } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';

const useStyles = makeStyles((theme) => ({
  container: {
    marginTop: theme.spacing(2),
  },
}));

const marks = Array.from(Array(20).keys()).map(k => (k + 1) * 5);

export interface PercentagesSelectorProps {
  name: string;
  value?: number[];
  onChange?: (value: number[]) => void;
  isReadOnly?: (value: number) => boolean;
}

export const PercentagesSelector: React.FC<PercentagesSelectorProps> = ({
  name,
  isReadOnly,
  onChange,
  ...props
}) => {
  const styles = useStyles();
  const [value, setValue] = useState(props.value || []);

  useEffect(() => {
    setValue(prev => {
      if (isEqual(props.value, prev)) {
        return props.value || [];
      }

      return prev;
    })
  }, [props.value]);

  const handleChange = useCallback((event) => {
    const targetValue = Number(event.target.value);
    const readonly = isReadOnly?.(targetValue);

    if (!readonly) {
      let newValue = [];
      if (!event.target.checked) {
        newValue = value.filter(x => x !== targetValue);
      } else {
        newValue = [...value, targetValue].sort((a, b) => a - b);
      }
      setValue(newValue);
      onChange?.(newValue);
    }
  }, [value, onChange]);

  return (<Box className={styles.container}>
    {marks.map(m => (<CheckboxInput 
      key={`percentage_${m}`}
      name={name}
      value={m}
      checked={value.includes(m)}
      readonly={isReadOnly?.(m)}
      onChange={handleChange}
    /> ))}
  </Box>);
}
