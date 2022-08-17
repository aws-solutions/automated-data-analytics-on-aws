/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Alert, Heading, Stack } from 'aws-northstar';
import { ApiError } from '@ada/api';
import { isApiError } from '@ada/api/client/types';
import HeadingStripe from '../HeadingStripe';
import React, { ReactNode } from 'react';

export interface PageNotFoundProps {
  title?: React.ReactChild | React.ReactFragment;
  description?: React.ReactChild | React.ReactFragment;
  details?: ReactNode | ApiError;
  destinationLinksHeading?: string;
  destinationLinks?: React.ReactNode[];
  tipHeading?: string;
  tip?: ReactNode;
}

export const PageNotFound: React.FC<PageNotFoundProps> = ({
  children,
  title = 'Not found',
  description,
  details,
  destinationLinksHeading = 'Alternative destinations',
  destinationLinks,
  tipHeading = 'Tip',
  tip,
}) => {
  if (details && isApiError(details)) {
    details = (
      <Alert type="error" header={details.message}>
        {details.details}
      </Alert>
    );
  }

  return (
    <Stack spacing="l">
      <HeadingStripe title={title} subtitle={description} />
      {details || children}
      {destinationLinks && (
        <>
          <Heading variant="h5">{destinationLinksHeading}</Heading>
          <Stack>{destinationLinks}</Stack>
        </>
      )}
      {tip && (
        <Alert type="info" header={tipHeading}>
          {tip}
        </Alert>
      )}
    </Stack>
  );
};
