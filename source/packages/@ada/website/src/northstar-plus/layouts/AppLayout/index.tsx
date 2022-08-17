/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import {
  HelpProvider,
  LayoutProvider,
  LayoutProviderProps,
  LayoutState,
  ManagedHelpPanelRenderer,
  useLayoutContext,
} from './components';
import {
  NotificationProvider,
  NotificationProviderProps,
  NotificationsRenderer,
} from '../../providers/NotificationProvider';
import { SideNavigationProps } from 'aws-northstar/components/SideNavigation';
import { Sidebar, SidebarType } from './components/Sidebar';
import { Theme, makeStyles } from '@material-ui/core/styles';
import Box from 'aws-northstar/layouts/Box';
import IconButton from '@material-ui/core/IconButton';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import LoadingIndicator from 'aws-northstar/components/LoadingIndicator';
import MenuIcon from '@material-ui/icons/Menu';
import Overlay from 'aws-northstar/components/Overlay';
import React, { FunctionComponent, ReactElement, ReactNode, useCallback } from 'react';
import clsx from 'clsx';

export * from './components';

export interface AppLayoutProviderProps {
  notificationConfig?: NotificationProviderProps;
  layoutConfig?: LayoutProviderProps;
}

export const AppLayoutProvider: FunctionComponent<AppLayoutProviderProps> = ({
  children,
  notificationConfig,
  layoutConfig,
}) => {
  return (
    <NotificationProvider {...notificationConfig}>
      <LayoutProvider {...layoutConfig}>
        <HelpProvider>{children}</HelpProvider>
      </LayoutProvider>
    </NotificationProvider>
  );
};

export interface AppLayoutProps extends AppLayoutProviderProps {
  /** The header */
  header: ReactNode;
  /** SideNavigation drawer. */
  navigation?: ReactElement<SideNavigationProps>;
  /** Breadcrumbs should be defined whithin this region in order to benefit from the responsive breadcrumb pattern. */
  breadcrumbs?: ReactNode;
  /** Whether to display in Progress global overlay */
  inProgress?: boolean;

  /**
   * Whether to render help panel
   * @default true
   */
  helpPanel?: boolean;

  /**
   * Height Of Header in pixel when custom header is used.
   * By default, 65px will be used for the <a href='/#/Components/Header'>NorthStar Header</a>. */
  headerHeightInPx?: number;
}

export const AppLayout: FunctionComponent<AppLayoutProps> = ({ children, ...props }) => {
  return (
    <AppLayoutProvider {...props}>
      <BaseAppLayout {...props}>{children}</BaseAppLayout>
    </AppLayoutProvider>
  );
};

/**
 * Basic layout for application, with place holder for header, navigation area, content area, breadcrumbs and tools/help panel.
 * It should be placed as the top most component in main content area. There should not be any spacing around it, it consumes
 * 100% of the width and height of the main content area, providing its own scrolling behavior.
 * By default it comes with a padding inside the content region. It can be removed by setting prop paddingContentArea == false.
 */
export const BaseAppLayout: FunctionComponent<AppLayoutProps> = ({
  children,
  header,
  navigation,
  breadcrumbs,
  inProgress = false,
  headerHeightInPx = 65,
  helpPanel = true,
}) => {
  const { layout, updateLayout, clientContext, contentRef } = useLayoutContext();

  const setIsSideNavigationOpen = useCallback(
    (open: boolean) => {
      updateLayout((draft) => {
        draft.sideNavigation = open;
      });
    },
    [updateLayout],
  );

  const setIsHelpPanelOpen = useCallback(
    (open: boolean) => {
      updateLayout((draft) => {
        draft.helpPanel = open;
      });
    },
    [updateLayout],
  );

  const classes = useStyles({
    sideNavigationState: layout.sideNavigation,
    helpPanelState: layout.helpPanel,
    inProgress,
    headerHeightInPx,
  });

  const renderNavigationIcon = useCallback(
    (rootClassname: string) => {
      return (
        <IconButton
          color="inherit"
          aria-label="open navigation drawer"
          data-testid="open-nav-drawer"
          onClick={() => setIsSideNavigationOpen(true)}
          classes={{
            root: clsx(rootClassname, classes.menu),
          }}
        >
          <MenuIcon />
        </IconButton>
      );
    },
    [classes, updateLayout, setIsHelpPanelOpen],
  );

  const renderInfoIcon = useCallback(
    (rootClassname: string) => {
      return (
        <IconButton
          color="inherit"
          aria-label="open help panel drawer"
          data-testid="open-helppanel-drawer"
          onClick={() => setIsHelpPanelOpen(true)}
          classes={{
            root: clsx(rootClassname, classes.menu),
          }}
        >
          <InfoOutlinedIcon />
        </IconButton>
      );
    },
    [classes, setIsHelpPanelOpen],
  );

  const { fullMode } = clientContext;

  return (
    <Box className={classes.root}>
      <Box className={classes.header}>
        {header}
        {!fullMode && (navigation || helpPanel) && (
          <Box className={classes.menuBar}>
            {navigation && <Box className={classes.menuBarNavIcon}>{renderNavigationIcon(classes.menuBarIcon)}</Box>}
            <Box width="100%" />
            {helpPanel && <Box className={classes.menuBarInfoIcon}>{renderInfoIcon(classes.menuBarIcon)}</Box>}
          </Box>
        )}
      </Box>
      <Box className={classes.main}>
        <Box className={classes.leftPane}>
          <Sidebar
            isOpen={layout.sideNavigation === true}
            setIsOpen={setIsSideNavigationOpen}
            type={SidebarType.SIDE_NAVIGATION}
            displayIcon={fullMode}
            renderIcon={renderNavigationIcon}
          >
            {navigation}
          </Sidebar>
        </Box>
        <div className={classes.content} ref={contentRef}>
          <NotificationsRenderer />
          <Box
            tabIndex={0}
            position="relative"
            className={clsx(classes.mainContent, {
              [classes.contentPadding]: layout.paddedContent,
            })}
          >
            {breadcrumbs && layout.breadcrumbs && <Box className={classes.breadcrumbsContainer}>{breadcrumbs}</Box>}
            <main>{children}</main>
            {inProgress && (
              <Overlay>
                <LoadingIndicator size="large" />
              </Overlay>
            )}
          </Box>
        </div>
        <Box className={classes.rightPane}>
          {helpPanel && (
            <Sidebar
              isOpen={layout.helpPanel === true}
              setIsOpen={setIsHelpPanelOpen}
              type={SidebarType.HELP_PANEL}
              displayIcon={fullMode}
              renderIcon={renderInfoIcon}
            >
              <ManagedHelpPanelRenderer />
            </Sidebar>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default AppLayout;

interface StyleProps {
  sideNavigationState: LayoutState;
  helpPanelState: LayoutState;
  inProgress: boolean;
  headerHeightInPx: number;
}

const useStyles = makeStyles<Theme, StyleProps>((theme) => ({
  root: {
    height: '100vh',
    margin: '0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flex: 0,
    height: ({ headerHeightInPx }) => headerHeightInPx,
  },
  main: {
    display: 'flex',
    flexDirection: 'row',
    flex: 1,
    height: ({ headerHeightInPx }) => `calc(100vh - ${headerHeightInPx}px)`,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    // https://stackoverflow.com/questions/36247140/why-dont-flex-items-shrink-past-content-size
    minWidth: 100,
    minHeight: 100,
    overflow: 'auto',
    boxSizing: 'border-box',
  },
  contentPadding: {
    [theme.breakpoints.up('sm')]: {
      padding: `${theme.spacing(2)}px ${theme.spacing(4)}px`,
    },
  },
  leftPane: {
    position: 'relative',
    flex: 0,
    backgroundColor: theme.palette.background.paper,
  },
  rightPane: {
    position: 'relative',
    flex: 0,
    backgroundColor: theme.palette.background.paper,
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    justifySelf: 'stretch',
    alignSelf: 'stretch',
    // border: '2px dotted lime',
    '&:focus': {
      outline: 'none',
    },
    '& > main': {
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      justifySelf: 'stretch',
      alignSelf: 'stretch',
      minWidth: 0,
      minHeight: 0,
      // border: '2px dashed red',

      // https://stackoverflow.com/questions/36247140/why-dont-flex-items-shrink-past-content-size
      '& div': {
        minWidth: 0,
        minHeight: 0,
        boxSizing: 'border-box',
      },
      '& .MuiTable-root *': {
        textOverflow: 'ellipsis',
        overflow: 'hidden',
      },
    },
  },
  breadcrumbsContainer: {
    flex: 0,
    display: 'none',
    marginBottom: theme.spacing(4),
    [theme.breakpoints.up('sm')]: {
      display: 'block',
    },
  },
  menu: {
    position: 'absolute',
    [theme.breakpoints.up('sm')]: {
      position: 'absolute',
      top: '20px',
      paddingRight: 0,
    },
  },
  menuBar: {
    display: 'flex',
    boxShadow: '0 2px 1px -1px rgba(0,28,36,.3)',
  },
  menuBarIcon: {
    padding: theme.spacing(2),
  },
  menuBarNavIcon: {
    flexShrink: 1,
    borderRight: `1px solid ${theme.palette.grey['400']}`,
  },
  menuBarInfoIcon: {
    flexShrink: 1,
    borderLeft: `1px solid ${theme.palette.grey['400']}`,
  },
}));
