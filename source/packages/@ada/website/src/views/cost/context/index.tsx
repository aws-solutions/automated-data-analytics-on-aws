/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as POLLING from '$config/polling';
import { ENV_TEST } from '$config';
import { GetCostOutput } from '@ada/api';
import { Skeletons } from '$northstar-plus/components/skeletons';
import { apiHooks } from '$api';
import { findTotalCost } from '../components/AccountCosts';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useNotificationContext } from '$northstar-plus';
import AccountsCostsError, { ZeroCostWarning } from '../components/AccountsCostsError';
import React, { SetStateAction, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import moment, { Moment } from 'moment';

const DEFAULT_PRICE_FORMAT: Intl.NumberFormatOptions = {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

interface ICostContext {
  costs: GetCostOutput;
  totalCost?: number;
  days: number;
  setDays: React.Dispatch<SetStateAction<number>>;
  handleDaysSelection: (e: any, days: number) => void;
  startDate: Moment;
  endDate: Moment;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  error?: any;
  priceFormat: Intl.NumberFormatOptions;
  digits: number;
  setDigits: React.Dispatch<React.SetStateAction<number>>;
}

const CostContext = createContext<ICostContext | undefined>(undefined);

export function useCostContext() {
  const context = useContext(CostContext);
  if (context == null) throw new Error('Must wrap with CostContext.Provider');
  return context;
}

export const CostContextProvider: React.FC<{}> = ({ children }) => {
  const { LL } = useI18nContext();
  const { addError } = useNotificationContext();

  const [days, setDays] = useState(30);
  const [endDate, setEndDate] = useState<Moment>(() => moment());
  const [startDate, setStartDate] = useState(() => moment(endDate).subtract(days, 'days'));

  useEffect(() => {
    if (!ENV_TEST) {
      const interval = setInterval(() => {
        const now = moment();
        setEndDate(now);
        setStartDate(moment(now).subtract(days, 'days'));
      }, POLLING.COST_RERESH);

      return () => {
        clearInterval(interval);
      };
    }
    return undefined;
  }, [days]);

  const [totalCost, setTotalCost] = useState<number>();

  const [costs, { isLoading, isError, isFetching, error }] = apiHooks.useCosts(
    { startTimestamp: startDate.format('YYYY-MM-DD'), endTimestamp: endDate.format('YYYY-MM-DD') },
    {
      onError: useCallback(
        (_error) => {
          addError({
            header: 'Failed to load cost',
            content: _error.message,
          });
        },
        [addError],
      ),
      onSuccess: (_costs) => {
        setTotalCost(findTotalCost(_costs));
      },
    },
  );

  const handleDaysSelection = useCallback((_e: any, _days: number) => {
    const now = moment();
    setDays(_days);
    setStartDate(moment(now).subtract(_days, 'days'));
    setEndDate(now);
  }, []);

  const [digits, setDigits] = useState(DEFAULT_PRICE_FORMAT.maximumFractionDigits!);

  const priceFormat = useMemo(() => {
    return {
      ...DEFAULT_PRICE_FORMAT,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    };
  }, [digits]);

  if (isError) {
    return <AccountsCostsError error={error?.message || 'Failed to load cost'} />;
  }

  if (costs == null || isLoading) {
    return <Skeletons.Page title={LL.VIEW.COST.title()} />;
  }

  const context: ICostContext = {
    costs,
    totalCost,
    days,
    setDays,
    handleDaysSelection,
    startDate,
    endDate,
    isLoading,
    isFetching,
    isError,
    error,
    priceFormat,
    digits,
    setDigits,
  };

  return (
    <CostContext.Provider value={context}>
      {totalCost != null && totalCost <= 0 && <ZeroCostWarning />}
      {children}
    </CostContext.Provider>
  );
};
