/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Alert, Badge, Box, Button, Container, Inline, StatusIndicator } from 'aws-northstar';
import { Column, Skeletons, useNotificationContext } from '$northstar-plus';
import { Fullscreen, FullscreenExit } from '@material-ui/icons';
import { LAYOUTS, useQueryWorkbench } from '../context';
import { PaginatedQueryResultTable } from '$common/components/tables';
import { QueryExecutionStatus, hasQueryFailed } from '@ada/common';
import { QueryResult, QueryResultColumnMetadata } from '@ada/api';
import { api, apiHooks } from '$api';
import {
  generateDataColumnDefinitions,
  sanitiseAccessorForTable,
  sanitiseDataForTable,
} from '$common/utils/data-product';
import { startCase } from 'lodash';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useTheme } from '@material-ui/core';
import React, { useCallback, useMemo, useRef, useState } from 'react';

export interface QueryResultProps {}

const QUERY_RESULT_PAGE_SIZE = 100;

const RUNNING_EXECUTION_ERROR = 'QueryExecutionResultsNotReady';

export const QueryExecutionResultTable: React.FC<QueryResultProps> = () => {
  const { LL } = useI18nContext();
  const theme = useTheme();
  const { executionInfo, queryStatus, setDataIntegrity, isExecutingQuery } = useQueryWorkbench();
  const executionId = executionInfo?.executionId;
  const { addError } = useNotificationContext();
  const [columnDefinitions, setColumnDefinitions] = useState<Column<object>[]>([]);
  const [pageSize, setPageSize] = useState<number>(QUERY_RESULT_PAGE_SIZE);

  const queryFailed = queryStatus && hasQueryFailed(queryStatus.status as QueryExecutionStatus);

  const invalidateRef = useRef<CallableFunction>();
  const paginatedQueryResults = apiHooks.usePaginatedQueryResults(
    {
      executionId: executionId as string,
      retrieveDataIntegrity: true,
      pageSize,
    },
    {
      enabled: executionId != null && queryStatus?.status === QueryExecutionStatus.SUCCEEDED,
      cacheTime: Infinity,
      staleTime: Infinity,
      retry(_failureCount, _error) {
        return _error.name === RUNNING_EXECUTION_ERROR;
      },
      onError: useCallback(
        (_error: any) => {
          if (_error.name === RUNNING_EXECUTION_ERROR) {
            console.warn('Request to fetch query results performed before ready.', _error);

            // invalidate results to ensure when status changes we pull again
            // * should be automatic but have seem intermittent issues so adding a bit of force
            if (invalidateRef.current) {
              invalidateRef.current();
            }
            return;
          }

          addError({
            header: _error.message,
            content: _error.details,
            dismissible: true,
          });
        },
        [addError],
      ),
      onResponse: (_response) => {
        setDataIntegrity(_response.dataIntegrity);

        setColumnDefinitions(marshallColumnsDefinitions(_response));
      },
      select: (_result) => {
        return sanitiseDataForTable(_result.data) as any;
      },
    },
  );
  const { isFetching, isFetchingNextPage, invalidate } = paginatedQueryResults;
  invalidateRef.current = invalidate;

  if (queryFailed) {
    return (
      <Box style={{ padding: 20 }}>
        <Alert type="warning" header={LL.VIEW.QUERY.STATUS.FAILED.label()}>
          {(queryStatus as any).reason}
        </Alert>
      </Box>
    );
  }

  if (isExecutingQuery || (isFetching && !isFetchingNextPage)) {
    return <Skeletons.Table rows={7} columns={7} />;
  }

  if (paginatedQueryResults.data == null) {
    return <Box padding={theme.spacing(0.5)}>{LL.VIEW.QUERY.RESULTS.emptyText()}</Box>;
  }

  return (
    <PaginatedQueryResultTable<'listQueryResults'>
      columnDefinitions={columnDefinitions as any}
      paginatedQuery={paginatedQueryResults}
      defaultPageSize={pageSize}
      onPageSizeChange={setPageSize}
      wrapText
      showRowNumber
      testid="query-results"
    />
  );
};

export const QueryResultPanel: React.FC<{}> = () => {
  const { LL } = useI18nContext();
  const { addError } = useNotificationContext();
  const { layout, setLayout, executionInfo, queryStatus, isExecutingQuery } = useQueryWorkbench();
  const isFullscreen = layout === LAYOUTS.FULLSCREEN;

  const toggleFullscreen = useCallback(() => {
    setLayout((current) => (current === LAYOUTS.FULLSCREEN ? LAYOUTS.DEFAULT : LAYOUTS.FULLSCREEN));
  }, [setLayout]);
  const executionId = executionInfo?.executionId as string;
  const [isExporting, setIsExporting] = useState(false);
  const exportEnabled =
    isExecutingQuery === false && isExporting === false && executionId != null && queryStatus?.status === 'SUCCEEDED';

  const onExport = useCallback(async () => {
    try {
      setIsExporting(true);
      const { signedUrl } = await api.getQueryResultDownload({ executionId });
      const url = new URL(signedUrl);
      const link = document.createElement('a');
      link.download = url.pathname.split('/').pop() as string;
      link.href = signedUrl;
      link.click();
    } catch (error: any) {
      addError({
        header: LL.VIEW.QUERY.RESULTS.EXPORT.failed.label(),
        content: error.message,
      });
    } finally {
      setIsExporting(false);
    }
  }, [executionId, setIsExporting, addError]);

  const status = useMemo<React.ReactNode>(() => {
    switch (queryStatus?.status) {
      case QueryExecutionStatus.ABORTED:
      case QueryExecutionStatus.CANCELLED: {
        return <StatusIndicator statusType="warning">{startCase(queryStatus.status.toLowerCase())}</StatusIndicator>;
      }
      case QueryExecutionStatus.FAILED:
      case QueryExecutionStatus.TIMED_OUT: {
        return <StatusIndicator statusType="negative">{startCase(queryStatus.status.toLowerCase())}</StatusIndicator>;
      }
      case QueryExecutionStatus.QUEUED:
      case QueryExecutionStatus.RUNNING: {
        return <StatusIndicator statusType="info">{startCase(queryStatus.status.toLowerCase())}</StatusIndicator>;
      }
      case QueryExecutionStatus.SUCCEEDED: {
        return <StatusIndicator statusType="positive">{startCase(queryStatus.status.toLowerCase())}</StatusIndicator>;
      }
      default: {
        return null;
      }
    }
  }, [queryStatus?.status]);

  const actionGroup = useMemo(() => {
    return (
      <Inline>
        {status}
        <Button
          onClick={onExport}
          disabled={!exportEnabled}
          loading={isExporting}
          label={LL.VIEW.QUERY.ACTIONS.export.label()}
        >
          {LL.VIEW.QUERY.ACTIONS.export.text()}
        </Button>
        <Button variant="icon" icon={isFullscreen ? FullscreenExit : Fullscreen} onClick={toggleFullscreen} />
      </Inline>
    );
  }, [onExport, exportEnabled, isFullscreen, toggleFullscreen, status]);

  return (
    <Container
      title={LL.VIEW.QUERY.RESULTS.title()}
      headerContent={<DataIntegrityDisplay />}
      actionGroup={actionGroup}
      gutters={false}
    >
      <QueryExecutionResultTable />
    </Container>
  );
};

const DataIntegrityDisplay: React.FC<{}> = () => {
  const { LL } = useI18nContext();
  const { executionInfo, dataIntegrity } = useQueryWorkbench();
  if (dataIntegrity == null || executionInfo == null) return null;

  if (dataIntegrity === 'stale') return <Badge key="stale" color="red" content={LL.VIEW.QUERY.DATA_INTEGRITY.stale.label()} />;

  return null;
};

function marshallColumnsDefinitions(result?: QueryResult): Column<object>[] {
  if (result == null) return [];
  if (result?.columns) {
    const columns: QueryResultColumnMetadata[] = result.columns;

    return columns.map(
      (column): Column<object> => ({
        accessor: sanitiseAccessorForTable(column.name),
        id: sanitiseAccessorForTable(column.name),
        Header: column.label || column.name,
      }),
    );
  } else {
    // fallback to inferring columns from data
    return generateDataColumnDefinitions(sanitiseDataForTable(result?.data || []));
  }
}
