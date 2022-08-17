/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Stack } from 'aws-northstar';
import { Theme, makeStyles } from '@material-ui/core/styles';
import Box from 'aws-northstar/layouts/Box';
import Heading from 'aws-northstar/components/Heading';
import React, { FunctionComponent, ReactNode } from 'react';
import Typography from '@material-ui/core/Typography';
import clsx from 'clsx';

export interface HeadingStripeProps {
  /** The title to display */
  title: React.ReactChild | React.ReactFragment;
  /** The subtitle to display */
  subtitle?: React.ReactChild | React.ReactFragment;
  /** Components to render in the right portion of the header */
  actionButtons?: ReactNode;
}

/** A heading that spans the full width of its container */
export const HeadingStripe: FunctionComponent<HeadingStripeProps> = ({ title, subtitle, actionButtons }) => {
  const classes = useStyles();
  return (
    <Box width="100%" display="flex">
      <Box flexGrow="1">
        <Stack spacing="xs">
          <Heading variant="h1">{title}</Heading>
          {subtitle && (
            <Typography
              variant="subtitle1"
              component="div"
              className={clsx(classes.noLineHeight, classes.containerSubtitle)}
            >
              {subtitle}
            </Typography>
          )}
        </Stack>
      </Box>
      {actionButtons && <Box>{actionButtons}</Box>}
    </Box>
  );
};

export default HeadingStripe;

const useStyles = makeStyles<Theme>(() => ({
  containerSubtitle: {
    marginTop: '5px',
  },
  noLineHeight: {
    lineHeight: 'initial',
  },
}));
