/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { makeStyles } from '@material-ui/core/styles';
import Box from 'aws-northstar/layouts/Box';
import Container from 'aws-northstar/layouts/Container';
import MuiTabs, { TabsProps as MuiTabsProps } from '@material-ui/core/Tabs';
import React, { ReactElement, ReactNode } from 'react';
import Tab, { TabProps as MuiTabProps } from '@material-ui/core/Tab';
import Typography from '@material-ui/core/Typography';
import clsx from 'clsx';

const useStyles = makeStyles((theme) => ({
  tab: {
    marginRight: '-1px',
    borderRight: `1px solid ${theme.palette.grey[400]}`,
    padding: '5px 20px',
    '&:last-child': {
      borderRight: 'none',
    },
  },
  noBorder: {
    '& .MuiTabs-scroller': {
      borderBottom: 'none',
    },
  },
}));

export interface TabItem {
  label: string | ReactNode;
  id: string;
  content: ReactNode;
  disabled?: boolean;
}

export type TabPropsOverrides = Omit<MuiTabProps, 'disabled' | 'label'>;
export type TabsPropsOverrides = Omit<MuiTabsProps, 'onChange' | 'value'>;

export interface TabsProps {
  /**
   * Array of objects, each having the following properties: <br/>
   * - id [string]: The tab id, this value will be set to activeTabId when the tab is selected. <br/>
   * - label [string]: Tab label shown in the UI. <br/>
   * - content [ReactNode]: Tab content to render in the container. <br/>
   * - disabled [boolean]: Whether this item is disabled.
   */
  tabs: TabItem[];
  /** Id of the currently active tab. Updates are triggered upon the change event. */
  activeId?: string;
  /**
   * Visual of the tabs: <br/>
   * - default: can be used in any context <br/>
   * - container: version with borders, designed to be used along with other containers
   */
  variant?: 'default' | 'container';
  /**
   * Whether to render padding within the content area
   * */
  paddingContentArea?: boolean;
  /**
   * Fired whenever the user selects a different tab. The event detail contains the current activeTabId. */
  onChange?: (activeTabId: string) => void;

  tabProps?: TabPropsOverrides;
  tabsProps?: TabsPropsOverrides;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
  paddingContentArea: boolean;
}

function TabPanel({ children, value, index, paddingContentArea }: TabPanelProps) {
  return (
    <Typography component="div" role="tabpanel" hidden={value !== index} id={`tabpanel-${index}`}>
      <Box py={paddingContentArea ? 3 : undefined}>{children}</Box>
    </Typography>
  );
}

/**
 * Use tabs for organizing discrete blocks of information.
 */
export const Tabs = ({
  tabs,
  activeId = '',
  variant = 'default',
  paddingContentArea = true,
  tabProps,
  tabsProps,
  onChange,
}: TabsProps): ReactElement => {
  const classes = useStyles({});
  const tabIndex = tabs.findIndex((tab) => tab.id === activeId);
  const [value, setValue] = React.useState(tabIndex === -1 ? 0 : tabIndex);
  const handleChange = (_event: React.ChangeEvent<{}>, index: number) => {
    onChange?.(tabs[index].id);
    setValue(index);
  };

  const headerContent = (
    <MuiTabs
      variant="scrollable"
      indicatorColor="secondary"
      TabIndicatorProps={{ color: 'primary' }}
      value={value}
      onChange={handleChange}
      className={clsx({ [classes.noBorder]: variant === 'container' })}
      {...tabsProps}
    >
      {tabs.map((tab) => (
        <Tab key={tab.id} className={classes.tab} label={tab.label} disabled={tab.disabled} {...tabProps} />
      ))}
    </MuiTabs>
  );

  const tabContent = tabs.map((tab, idx) => (
    <TabPanel key={tab.id} value={value} index={idx} paddingContentArea={paddingContentArea}>
      {tab.content}
    </TabPanel>
  ));

  return variant === 'container' ? (
    <Container headerContent={headerContent} headerGutters={false} gutters={paddingContentArea}>
      {tabContent}
    </Container>
  ) : (
    <>
      {headerContent}
      {tabContent}
    </>
  );
};

export default Tabs;
