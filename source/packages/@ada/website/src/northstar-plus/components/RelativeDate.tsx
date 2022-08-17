/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Tooltip, TooltipProps } from './Tooltip';
import { isString } from 'lodash';
import React from 'react';
import ReactTimeago, { ReactTimeagoProps } from 'react-timeago';
import moment from 'moment';

export interface RelativeDateProps {
  date?: ReactTimeagoProps['date'];
  formatter?: ReactTimeagoProps['formatter'];

  /**
   * @default true
   */
  tooltip?: boolean | TooltipProps['content'];
  /**
   * @default undefined
   */
  tooltipHeader?: TooltipProps['header'];
}

export const RelativeDate: React.FC<RelativeDateProps> = ({ date, formatter, tooltip, tooltipHeader }) => {
  if (date == null) return null;

  if (tooltip !== false) {
    if (tooltip == null || tooltip === true) {
      tooltip = <span>{isString(date) ? date : new Date(date).toLocaleString()}</span>;
    }

    return (
      <Tooltip header={tooltipHeader} content={isString(tooltip) ? <span>{tooltip}</span> : tooltip}>
        <ReactTimeago
          date={date}
          formatter={formatter}
          minPeriod={60}
          min="< 1 minute"
          maxPeriod={moment.duration(1, 'year').seconds()}
          max="> 1 year"
        />
      </Tooltip>
    );
  }

  return (
    <ReactTimeago
      date={date}
      formatter={formatter}
      minPeriod={60}
      min="< 1 minute"
      maxPeriod={moment.duration(1, 'year').seconds()}
      max="> 1 year"
    />
  );
};
