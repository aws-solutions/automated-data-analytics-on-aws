/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as POLLING from '$config/polling';
import { QueryExecutionStatus, hasQueryFailed, isQueryExecuting } from '@ada/common';
import { QueryStatus } from '@ada/api';
import { api } from '$api';
import { isDataEqual } from '$common/utils';
import { useEffect, useState } from 'react';
import { useStatefulRef } from '$common/hooks';

interface UserQuerySTatusPollerProps {
  /** Interval rate to poll for status changes */
  interval?: number;
  /** Callback for all status changes */
  onStatusChange?: (status: QueryStatus) => void;
  /** Callback for terminal states; execution has completed */
  onFinally?: (status: QueryStatus) => void;
  /** Callback for failed status */
  onFailed?: (status: QueryStatus) => void;
  /** Callback for succeeded status */
  onSucceeded?: () => void;
}

export const useQueryStatusPoller = (executionId?: string, options?: UserQuerySTatusPollerProps) => {
  const executionIdRef = useStatefulRef(executionId);
  const [queryStatus, setQueryStatus] = useState<QueryStatus>();
  const { interval = POLLING.QUERY_STATUS, onStatusChange, onFinally, onFailed, onSucceeded } = options || {};

  /* eslint-disable sonarjs/cognitive-complexity */
  useEffect((): any => { //NOSONAR (S3776:Cognitive Complexity) - won't fix
    if (executionId != null) {
      // reset the status when execution id is modified
      setQueryStatus(undefined);

      // Create a new AbortController instance for this request
      const controller = new AbortController();
      // Get the abortController's signal
      const signal = controller.signal;

      const _intervalId = setInterval(async () => {
        try {
          // only poll status for most current query execution
          if (executionIdRef.current !== executionId) return;

          const _queryStatus = await api.getQueryStatus({ executionId }, { signal });

          // only set status if still the same execution id as when started
          if (executionIdRef.current !== executionId) return;

          // update status if has changed
          setQueryStatus((current) => {
            if (isDataEqual(current, _queryStatus)) {
              return current;
            }

            return _queryStatus;
          });

          const status = _queryStatus.status as QueryExecutionStatus;

          if (hasQueryFailed(status)) {
            onFailed && onFailed(_queryStatus);
          }

          if (status === QueryExecutionStatus.SUCCEEDED) {
            onSucceeded && onSucceeded();
          }

          if (isQueryExecuting(status) === false) {
            clearInterval(_intervalId);
            onFinally && onFinally(_queryStatus);
          }
        } catch (error: any) {
          console.warn('useQueryStatusPoller:getQueryStatus:error:', error);
        }
      }, interval);

      return () => {
        clearInterval(_intervalId);
        controller.abort();
      };
    }
  }, [executionId]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable sonarjs/cognitive-complexity */

  useEffect(() => {
    if (queryStatus && onStatusChange) {
      onStatusChange(queryStatus);
    }
  }, [queryStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  return queryStatus;
};
