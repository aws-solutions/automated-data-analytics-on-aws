/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import FirstPage from '@material-ui/icons/FirstPage';
import IconButton from '@material-ui/core/IconButton';
import LastPage from '@material-ui/icons/LastPage';
import NavigateBefore from '@material-ui/icons/NavigateBefore';
import NavigateNext from '@material-ui/icons/NavigateNext';
import React, { ReactNode } from 'react';
import SettingsOutlined from '@material-ui/icons/SettingsOutlined';
import SettingsPopover from 'aws-northstar/components/Table/components/SettingsPopover';

/**
 * CHANGE: @jerjonas
 * - add Infinite icon for `-1` totalCount
 */

export interface SettingsBarProps {
  pageIndex: number;
  pageSize: number;
  pageSizes: number[];
  pageLength: number;
  rowCount: number;
  totalCount: number;
  disablePagination?: boolean;
  disableSettings?: boolean;
  disableGroupBy?: boolean;
  loading?: boolean;
  gotoPage?: (pageIndex: number) => void;
  previousPage?: () => void;
  canPreviousPage?: boolean;
  nextPage?: () => void;
  canNextPage?: boolean;
  setPageSize?: (size: number) => void;
  styles: {
    leftSpace: string;
    verticalGrid: string;
  };
  columnsGroupingComponent: ReactNode;
  columnsSelectorComponent: ReactNode;
}

export default function SettingBar({
  pageIndex,
  pageSize,
  pageSizes,
  pageLength,
  loading,
  rowCount,
  totalCount,
  disablePagination,
  disableSettings,
  disableGroupBy = false,
  gotoPage,
  previousPage,
  nextPage,
  setPageSize,
  styles,
  columnsGroupingComponent,
  columnsSelectorComponent,
  canPreviousPage = false,
  canNextPage = false,
}: SettingsBarProps) {
  const [settingsAnchor, setSettingsAnchor] = React.useState<HTMLButtonElement | null>(null);
  const handleSettingsClick = (event: React.MouseEvent<any, MouseEvent>) => {
    setSettingsAnchor(event.currentTarget);
  };

  const handleSettingsClose = () => {
    setSettingsAnchor(null);
  };

  const settingsOpen = Boolean(settingsAnchor);
  const settingsId = settingsOpen ? 'settings-popover' : undefined;

  const settingsPopoverProps = {
    pageSize,
    pageSizes,
    settingsId,
    loading,
    settingsOpen,
    disableGroupBy,
    gotoPage,
    settingsAnchor,
    handleSettingsClose,
    setPageSize,
    styles,
    columnsGroupingComponent,
    columnsSelectorComponent,
  };

  const isInfinite = totalCount === -1;

  if (!(disablePagination && disableSettings)) {
    return (
      <div>
        {!disablePagination && (
          <>
            <IconButton
              size="small"
              aria-label="first page"
              disabled={pageIndex === 0 || loading}
              data-testid="first-page"
              onClick={() => gotoPage?.(0)}
            >
              <FirstPage />
            </IconButton>
            <IconButton
              size="small"
              aria-label="previous page"
              disabled={!canPreviousPage || loading}
              data-testid="previous-page"
              onClick={previousPage}
            >
              <NavigateBefore />
            </IconButton>
            <span>
              {`${pageIndex * pageSize + 1}-${pageIndex * pageSize + pageLength}`}
              {isInfinite ? '' : ` of ${totalCount}`}
            </span>
            <IconButton
              aria-label="next page"
              size="small"
              disabled={!canNextPage || loading}
              data-testid="next-page"
              onClick={nextPage}
            >
              <NavigateNext />
            </IconButton>
            {isInfinite !== true && (
              <IconButton
                aria-label="last page"
                size="small"
                data-testid="last-page"
                disabled={pageIndex * pageSize + pageLength >= rowCount || loading}
                onClick={() => gotoPage?.(Math.ceil(rowCount / pageSize) - 1)}
              >
                <LastPage />
              </IconButton>
            )}
          </>
        )}
        {!disableSettings && (
          <>
            <IconButton
              size="small"
              aria-label="settings"
              className={styles.leftSpace}
              aria-describedby={settingsId}
              disabled={loading}
              data-testid="settings"
              onClick={handleSettingsClick}
            >
              <SettingsOutlined fontSize="small" />
            </IconButton>
            <SettingsPopover {...settingsPopoverProps} />
          </>
        )}
      </div>
    );
  }

  return null;
}
