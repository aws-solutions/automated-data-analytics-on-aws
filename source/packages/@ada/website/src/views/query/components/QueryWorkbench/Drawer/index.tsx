/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Drawer } from '@material-ui/core';
import { Library } from './tabs/Library';
import { TabItem, Tabs, TabsPropsOverrides } from '$northstar-plus/components/Tabs';
import { Theme, makeStyles } from 'aws-northstar';
import { useQueryWorkbench } from '../context';
import React, { useMemo } from 'react';

export interface SidebarTabsProps {}

export const QueryWorkbenchDrawer: React.FC<SidebarTabsProps> = () => {
  const { isDrawerOpen } = useQueryWorkbench();

  const classes = useStyles({
    isDrawerOpen: true,
  });

  const tabs = useMemo<TabItem[]>(() => {
    return [
      {
        id: 'library',
        label: 'Library',
        content: <Library />,
      },
    ];
  }, []);

  const tabsProps = useMemo<TabsPropsOverrides>(() => {
    return {
      variant: 'fullWidth',
    };
  }, []);

  return (
    <Drawer variant="persistent" anchor="left" open={isDrawerOpen} className={classes.drawer}>
      <Tabs tabsProps={tabsProps} paddingContentArea={false} tabs={tabs} />
    </Drawer>
  );
};

interface StyleProps {
  // isDrawerOpen: boolean;
}

const useStyles = makeStyles<Theme, StyleProps>(() => ({
  drawer: {
    width: 240,
    '& > .MuiPaper-root': {
      position: 'relative',
    },
  },
}));
