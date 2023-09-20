/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataIntegrityEnum, QueryExecution, QueryStatus } from '@ada/api';
import { ENV_STORYBOOK, ENV_TEST, getSolutionPersistenceKey } from '$config';
import { IAceEditor } from 'react-ace/lib/types';
import { QueryExecutionStatus } from '@ada/common';
import { apiHooks } from '$api';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useNotificationContext } from '$northstar-plus';
import { useQueryStatusPoller } from './hooks';
import React, { RefObject, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import useLocalStorage from 'react-use-localstorage';

const LOCAL_STORAGE_KEY_QUERYWORKBENCH_DRAWER_OPEN = getSolutionPersistenceKey('query.workbench.drawer.open', false);
const LOCAL_STORAGE_KEY_QUERYWORKBENCH_QUERY = getSolutionPersistenceKey('query.workbench.query', true);

const PERSIST = !ENV_TEST && !ENV_STORYBOOK;

export enum LAYOUTS {
  DEFAULT = 'default',
  FULLSCREEN = 'fullscreen:results',
}

export interface QueryExecutionInfo extends QueryExecution {
  query: string;
}

export type QueryWorkbendLayout = LAYOUTS;

export interface IQueryWorkbenchContext {
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;

  layout: QueryWorkbendLayout;
  setLayout: React.Dispatch<React.SetStateAction<QueryWorkbendLayout>>;

  getQuery: () => string;
  setQuery: (query: string, fromEditor?: boolean) => void;
  queryStatus?: QueryStatus;

  isExecutingQuery: boolean;
  setIsExcutingQuery: (value: boolean) => void;
  executionInfo?: QueryExecutionInfo;
  setExecutionInfo: (executionInfo: QueryExecutionInfo | undefined) => void;

  dataIntegrity?: DataIntegrityEnum;
  setDataIntegrity: (dataIntegrity: DataIntegrityEnum | undefined) => void;

  editorRef: RefObject<IAceEditor>;

  startQuery: () => void;
  cancelQuery: () => void;
}

const QueryWorkbenchContext = createContext<IQueryWorkbenchContext | undefined>(undefined);

export function useQueryWorkbench() {
  const context = useContext(QueryWorkbenchContext);
  if (context == null) throw new Error('Must wrap with QueryWorkbenchContext.Provider');
  return context;
}

export const QueryWorkbenchProvider: React.FC<{}> = ({ children }) => {
  const { LL } = useI18nContext();
  const { addError, addBrief } = useNotificationContext();

  const [isPeristentDrawerOpen, setIsPersitentDrawerOpen] = useLocalStorage(
    LOCAL_STORAGE_KEY_QUERYWORKBENCH_DRAWER_OPEN,
    'true',
  );
  const [isDrawerOpen, setIsDrawerOpen] = useState(isPeristentDrawerOpen !== 'false');
  const openDrawer = useCallback(() => {
    setIsDrawerOpen(true);
  }, [setIsDrawerOpen]);
  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, [setIsDrawerOpen]);
  const toggleDrawer = useCallback(() => {
    setIsDrawerOpen((current) => !current);
  }, [setIsDrawerOpen]);
  useEffect(() => {
    setIsPersitentDrawerOpen(isDrawerOpen ? 'true' : 'false');
  }, [isDrawerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const [layout, setLayout] = useState<QueryWorkbendLayout>(LAYOUTS.DEFAULT);

  const [isExecutingQuery, setIsExcutingQuery] = useState<boolean>(false);
  const [executionInfo, setExecutionInfo] = useState<QueryExecutionInfo>();

  const [dataIntegrity, setDataIntegrity] = useState<DataIntegrityEnum>();

  const editorRef = useRef<IAceEditor | null>(null);

  const [persistentQuery, setPersistentQuery] = useLocalStorage(
    LOCAL_STORAGE_KEY_QUERYWORKBENCH_QUERY,
    'SELECT * FROM ',
  );
  const queryRef = useRef<string>(persistentQuery);
  const getQuery = useCallback(() => queryRef.current, []);
  const setQuery = useCallback(
    (query: string, fromEditor?: boolean) => {
      console.debug('setQuery:', fromEditor, query);
      queryRef.current = query;

      // update the live ace editor
      if (fromEditor !== true && editorRef.current) {
        // setValue on document to enable undo https://github.com/ajaxorg/ace/issues/2558
        editorRef.current.getSession().getDocument().setValue(query);
      }
    },
    [editorRef],
  );

  // persist query to local storage periodically and on unmount
  useEffect((): any => {
    if (PERSIST) {
      const timer = setInterval(() => {
        setPersistentQuery(getQuery());
      }, 2500);

      return () => {
        clearInterval(timer);
        setPersistentQuery(getQuery());
      };
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [postQuery] = apiHooks.usePostQuery({
    retry: false,
    onError: useCallback(
      (error) => {
        setExecutionInfo(undefined);
        setIsExcutingQuery(false);

        addError({
          header: LL.VIEW.QUERY.STATUS.FAILED.label(),
          content: error.message,
        });
      },
      [setIsExcutingQuery, addError],
    ),
    onSuccess: useCallback(
      ({ executionId }, { query: { query } }) => {
        setExecutionInfo({
          executionId,
          query,
          // startTime,
        });
      },
      [setExecutionInfo],
    ),
  });

  const startQuery = useCallback(async () => {
    // make sure we have very latest query
    const query = getQuery();

    setExecutionInfo(undefined);
    setIsExcutingQuery(true);

    postQuery({ query: { query } });
  }, [getQuery, setExecutionInfo, setIsExcutingQuery, postQuery]);

  const cancelQuery = useCallback(() => {
    setExecutionInfo(undefined);
    setIsExcutingQuery(false);
  }, [setExecutionInfo, setIsExcutingQuery]);

  const polledQueryStatus = useQueryStatusPoller(executionInfo?.executionId, {
    onFinally: useCallback(() => {
      // mark as not querying on final states (inclues any failed states and succeeded)
      setIsExcutingQuery(false);
    }, [setIsExcutingQuery]),
    onFailed: useCallback(
      ({ status, reason }) => {
        // reset execution into on failure
        setExecutionInfo(undefined);

        switch (status) {
          case 'ABORTED':
          case 'CANCELLED': {
            addBrief({
              type: 'warning',
              header: LL.VIEW.QUERY.STATUS.CANCELLED.label(),
              content: reason,
            });
            break;
          }
          case 'FAILED': {
            break;
          }
          case 'TIMED_OUT': {
            addError({
              header: LL.VIEW.QUERY.STATUS.TIMED_OUT.label(),
              content: LL.VIEW.QUERY.STATUS.TIMED_OUT.hintText(),
            });
            break;
          }
        }
      },
      [addBrief, addError],
    ),
  });

  const queryStatus = useMemo<QueryStatus | undefined>(() => {
    if (executionInfo?.executionId) {
      return (
        polledQueryStatus || {
          status: QueryExecutionStatus.QUEUED,
        }
      );
    }

    return undefined;
  }, [polledQueryStatus]);

  const context: IQueryWorkbenchContext = useMemo(() => ({
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    getQuery,
    setQuery,
    queryStatus,
    isExecutingQuery,
    setIsExcutingQuery,
    executionInfo,
    setExecutionInfo,
    dataIntegrity,
    setDataIntegrity,
    editorRef,
    layout,
    setLayout,

    startQuery,
    cancelQuery,
  }), [isDrawerOpen, openDrawer, closeDrawer, toggleDrawer, getQuery, setQuery, queryStatus,
    isExecutingQuery, setIsExcutingQuery, executionInfo, setExecutionInfo, 
    dataIntegrity, setDataIntegrity, editorRef, 
    layout, setLayout, startQuery, cancelQuery
  ]);

  return <QueryWorkbenchContext.Provider value={context}>{children}</QueryWorkbenchContext.Provider>;
};
