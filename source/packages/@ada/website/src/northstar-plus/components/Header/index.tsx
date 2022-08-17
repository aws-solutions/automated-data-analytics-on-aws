/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { makeStyles, useTheme } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Box from 'aws-northstar/layouts/Box';
import React, { ReactNode } from 'react';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import useMediaQuery from '@material-ui/core/useMediaQuery';

const useStyles = makeStyles((theme) => ({
  root: {
    height: '65px',
    justifyContent: 'center',
  },
  paddedChildren: {
    '& > *': {
      paddingRight: theme.spacing(1),
    },
  },
  title: {
    fontSize: '28px',
    color: theme.palette.primary.contrastText,
    flexGrow: 0.5,
    whiteSpace: 'nowrap',
  },
  img: {
    verticalAlign: 'middle',
    maxHeight: '42px',
  },
  searchContainer: {
    flexGrow: 1.5,
    alignSelf: 'center',
    justifySelf: 'center',
    minWidth: '8em',
    maxWidth: '50em',
    marginRight: 'auto',
  },
}));

export interface HeaderProps {
  /** The title of the app */
  title: string;
  /** The url of the logo */
  logoPath?: string;
  /** The content at the top right corner */
  rightContent?: ReactNode;
  /** Hide the header below the given breakpoint */
  hideHeaderBelow?: 'xs' | 'sm' | 'md' | 'lg';
  /** The search bar content */
  search?: ReactNode;
}

/**
 * A header bar for an application
 */
export const Header = ({ title, logoPath, rightContent = null, hideHeaderBelow, search }: HeaderProps) => {
  const classes = useStyles({});
  const theme = useTheme();
  const matched = useMediaQuery(theme.breakpoints.up(hideHeaderBelow || 'sm'));

  return (
    <AppBar className={classes.root} position="static" elevation={0}>
      <Toolbar className={classes.paddedChildren}>
        {logoPath && (
          <a href="/">
            <img alt="Logo" src={logoPath} className={classes.img} />
          </a>
        )}
        {(!hideHeaderBelow || matched) && (
          <Typography component="span" className={classes.title}>
            {title}
          </Typography>
        )}
        {search && <Box className={classes.searchContainer}>{search}</Box>}
        {rightContent && <Box>{rightContent}</Box>}
      </Toolbar>
    </AppBar>
  );
};

export default Header;
