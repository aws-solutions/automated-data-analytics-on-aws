/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Theme, makeStyles } from '@material-ui/core/styles';
import Close from '@material-ui/icons/Close';
import Drawer from '@material-ui/core/Drawer';
import IconButton from '@material-ui/core/IconButton';
import React, { FunctionComponent, ReactNode } from 'react';

const OPEN_WIDTH = 285;
const CLOSED_WIDTH = 75;

export enum SidebarType {
  SIDE_NAVIGATION = 'SIDE_NAVIGATION',
  HELP_PANEL = 'HELP_PANEL',
}

export interface SidebarProps {
  openWidth?: number;
  closedWidth?: number;
  isOpen: boolean;
  displayIcon: boolean;
  setIsOpen: (open: boolean) => void;
  type: SidebarType;
  renderIcon: (rootClasses: string) => ReactNode;
}

export const Sidebar: FunctionComponent<SidebarProps> = (props) => {
  props = Object.assign<Partial<SidebarProps>, SidebarProps>(
    {
      openWidth: OPEN_WIDTH,
      closedWidth: CLOSED_WIDTH,
    },
    props,
  );
  const classes = useStyles(props);

  const handleDrawerClose = () => {
    props.setIsOpen(false);
  };

  return (
    <>
      {props.displayIcon &&
        props.type === SidebarType.SIDE_NAVIGATION &&
        !props.isOpen &&
        props.renderIcon(classes.sidebar)}
      <Drawer
        className={classes.drawer}
        variant="persistent"
        anchor={props.type === SidebarType.SIDE_NAVIGATION ? 'left' : 'right'}
        open={props.isOpen}
        classes={{
          paper: classes.drawerPaper,
        }}
        SlideProps={{
          timeout: 0,
        }}
      >
        <div className={classes.closeDrawer}>
          <IconButton onClick={handleDrawerClose}>
            <Close />
          </IconButton>
        </div>
        {props.children}
      </Drawer>
      {props.displayIcon && props.type === SidebarType.HELP_PANEL && !props.isOpen && props.renderIcon(classes.sidebar)}
    </>
  );
};

export default Sidebar;

const useStyles = makeStyles<Theme, SidebarProps>((theme) => ({
  drawer: {
    height: '100%',
    flexShrink: 0,
    width: (props) => (props.isOpen ? props.openWidth : props.closedWidth),
    transition: 'width 0.1s ease-out',
  },
  drawerPaper: {
    [theme.breakpoints.up('sm')]: {
      height: '100%',
      position: 'relative',
      // width: (props) => props.isOpen ? props.openWidth : props.closedWidth,
    },
    [theme.breakpoints.down('xs')]: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      zIndex: theme.zIndex.modal + 10,
    },
  },
  closeDrawer: {
    position: 'absolute',
    right: '20px',
    top: '15px',
    zIndex: 1,
    '& > button': {
      padding: 0,
    },
    '& > button > span': {
      padding: 0,
      display: 'inline',
      lineHeight: 1.5,
    },
  },
  sidebar: {
    display: 'flex',
    borderRadius: 0,
    backgroundColor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.grey['200']}`,
    minWidth: '50px',
  },
}));
