/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Alert, Text } from 'aws-northstar';
import { StatefulError, useStatefulErrors } from '../../../hooks';
import React, { Fragment } from 'react';

export interface ErrorAlertProps {
  readonly header?: string;
  readonly error?: StatefulError | StatefulError[];
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ header, error }) => {
  const errors = useStatefulErrors(...(Array.isArray(error) ? error : [error])) as any[];
  if (errors == null) return null;

  return (
    <Alert type="error" header={header || 'Error'}>
      {errors.map((_error, index) => {
        return (
          <Fragment key={`error-${index}`}>
            <Text variant="p">{_error.message || _error.type || String(_error)}</Text>
            {_error.details && (
              <Text variant="small" color="error">
                {_error.details}
              </Text>
            )}
            {index === errors.length - 1 ? null : <br />}
          </Fragment>
        );
      })}
    </Alert>
  );
};
