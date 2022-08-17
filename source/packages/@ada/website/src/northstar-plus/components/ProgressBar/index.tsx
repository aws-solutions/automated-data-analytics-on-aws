/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { makeStyles } from '@material-ui/core/styles';
import Box from 'aws-northstar/layouts/Box';
import Button from 'aws-northstar/components/Button';
import CircularProgress, { CircularProgressProps } from '@material-ui/core/CircularProgress';
import Grid from 'aws-northstar/layouts/Grid';
import Heading from 'aws-northstar/components/Heading';
import LinearProgress, { LinearProgressProps } from '@material-ui/core/LinearProgress';
import React, { FunctionComponent, useMemo } from 'react';
import StatusIndicator from 'aws-northstar/components/StatusIndicator';
import Text from 'aws-northstar/components/Text';
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles((theme) => ({
  colorPrimary: {
    marginTop: '8px',
  },
  circularColorPrimary: {
    color: theme.palette.info.dark,
    position: 'absolute',
    left: 0,
  },
  circularColorBottom: {
    color: theme.palette.grey[theme.palette.type === 'light' ? 200 : 700],
  },
  barColorPrimary: {
    backgroundColor: theme.palette.info.dark,
  },
  label: {
    color: theme.palette.text.primary,
  },
  description: {
    padding: theme.spacing(0.3, 0),
    color: theme.palette.text.secondary,
  },
  body: {
    display: 'inline-flex',
  },
  icon: {
    paddingTop: '4px',
  },
  resultButton: {
    marginLeft: '10px',
  },
}));

export interface ProgressBarProps {
  /** Percentage value of the progress */
  value?: number;
  /**
   * Use "in-progress" to display a progress bar.
   * "success" and "error" are result states and replace the progress element with a status indicator,
   * resultText and, if set, with a button containing resultButtonText.
   * */
  status?: 'in-progress' | 'success' | 'error';
  /**
   * Text for the button that gets displayed when status is set to "error" or "success".
   * If resultButtonText is empty, no button will be displayed. */
  resultButtonText?: string;
  /** Short information summarizing the operation */
  label?: string;
  /** More detailed information about the operation, rendered between the progress bar and label. */
  description?: string;
  /** Information that is displayed below the progress bar. */
  additionalInfo?: string;
  /** Content that is displayed whenever status is set to "error" or "success". */
  resultText?: string;
  /** Indicate whether to display value on the right end */
  displayValue?: boolean;
  /** Fired when the user triggers the result state button. */
  resultButtonClick?: () => void;
  /** Indicate what type of progress bar to render */
  variant?: 'linear' | 'circular';
}

interface ProgressBarComponentProps {
  value: number;
  displayValue: boolean;
}

const statusMapping: { [key in 'error' | 'success']: 'negative' | 'positive' } = {
  error: 'negative',
  success: 'positive',
};

const LinearProgressComponent: React.FunctionComponent<
  ProgressBarComponentProps & Omit<LinearProgressProps, 'variant'>
> = ({ value, displayValue, ...props }) => {
  const classes = useStyles();

  let variant: LinearProgressProps['variant'] = 'determinate';
  // CHANGE - enable indeterminate variant
  if (value === Infinity) {
    variant = 'indeterminate';
    // @ts-ignore
    value = undefined;
  }

  return (
    <Grid container spacing={3}>
      {/* CHANGE: fix 0 value display conditional */}
      <Grid item xs={value != null && displayValue ? 11 : 12}>
        <LinearProgress
          variant={variant}
          value={value}
          classes={{
            colorPrimary: classes.colorPrimary,
            barColorPrimary: classes.barColorPrimary,
          }}
          {...props}
        />
      </Grid>
      {displayValue && value && (
        <Grid item xs={1}>
          <Text>{value}%</Text>
        </Grid>
      )}
    </Grid>
  );
};

const CircularProgressWithLabel: React.FunctionComponent<
  ProgressBarComponentProps & Omit<CircularProgressProps, 'variant'>
> = ({ value, displayValue, ...props }) => {
  const classes = useStyles();

  let variant: CircularProgressProps['variant'] = 'determinate';
  if (value === Infinity) {
    variant = 'indeterminate';
    // @ts-ignore
    value = undefined;
  }
  return (
    <Box position="relative" display="inline-flex">
      <CircularProgress
        value={100}
        variant={variant}
        classes={{ colorPrimary: classes.circularColorBottom }}
        {...props}
      />
      <CircularProgress
        variant={variant}
        value={value}
        classes={{ colorPrimary: classes.circularColorPrimary }}
        {...props}
      />
      {displayValue && (
        <Box
          display="flex"
          top={0}
          bottom={0}
          right={0}
          left={0}
          position="absolute"
          alignItems="center"
          justifyContent="center"
        >
          <Typography variant="caption" component="div" color="textSecondary">{`${Math.round(value)}%`}</Typography>
        </Box>
      )}
    </Box>
  );
};

/**
 * A progress bar is a horizontal progress-bar for indicating progress and activity.
 */
export const ProgressBar: FunctionComponent<
  ProgressBarProps & Omit<LinearProgressProps & CircularProgressProps, 'variant'>
> = ({
  value,
  displayValue = true,
  status = 'in-progress',
  variant = 'linear',
  label,
  description,
  additionalInfo,
  resultText,
  resultButtonText,
  resultButtonClick,
  ...props
}) => {
  const classes = useStyles();

  const progressBody = (_ProgressBarComponent: React.FunctionComponent<ProgressBarComponentProps>): React.ReactNode => {
    if (status === 'error' || status === 'success') {
      return (
        <div className={classes.body}>
          <div className={classes.icon}>
            <StatusIndicator statusType={statusMapping[status]}>{resultText}</StatusIndicator>
          </div>
          {resultButtonText && (
            <div className={classes.resultButton}>
              <Button onClick={resultButtonClick}>{resultButtonText}</Button>
            </div>
          )}
        </div>
      );
    }

    return <_ProgressBarComponent value={value || (value === 0 ? 0 : 100)} displayValue={displayValue} {...props} />;
  };

  const ProgressBarComponent = useMemo(
    () => (variant === 'linear' ? LinearProgressComponent : CircularProgressWithLabel),
    [variant],
  );

  return (
    <>
      {label && <Heading variant="h3">{label}</Heading>}
      {description && (
        <Typography className={classes.description} variant="body1">
          {description}
        </Typography>
      )}
      {progressBody(ProgressBarComponent)}
      {additionalInfo && (
        <Typography className={classes.description} variant="body1">
          {additionalInfo}
        </Typography>
      )}
    </>
  );
};

export default ProgressBar;
