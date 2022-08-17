/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductState } from '../common';
import { LoadingIndicator, StatusIndicator } from 'aws-northstar';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import React from 'react';

export interface StatusProps extends DataProductState {
  readonly detailed?: boolean;
}

export const Status: React.FC<StatusProps> = ({
  detailed,
  infra,
  data,
  isProvisioning,
  hasProvisioningFailed,
  isMissingData,
  isImporting,
  hasImportingFailed,
  isQueryable,
  isReady,
}) => {
  const { LL } = useI18nContext();
  switch (true) {
    case isProvisioning:
      return <LoadingIndicator label={LL.VIEW.DATA_PRODUCT.STATUS.isProvisioning()} />;
    case hasProvisioningFailed:
      return <StatusIndicator statusType="negative">{detailed ? infra.details : LL.VIEW.DATA_PRODUCT.STATUS.hasProvisioningFailed()}</StatusIndicator>;
    case isMissingData:
      return <StatusIndicator statusType="warning">{LL.VIEW.DATA_PRODUCT.STATUS.isMissingData()}</StatusIndicator>;
    case isImporting:
      return <LoadingIndicator label={LL.VIEW.DATA_PRODUCT.STATUS.isImporting()} />;
    case hasImportingFailed:
      return <StatusIndicator statusType="negative">{detailed ? data.details : LL.VIEW.DATA_PRODUCT.STATUS.hasImportingFailed()}</StatusIndicator>;
    case isQueryable:
    case isReady:
      return <StatusIndicator statusType="positive">{LL.VIEW.DATA_PRODUCT.STATUS.isReady()}</StatusIndicator>;
    default:
      return <>{LL.VIEW.DATA_PRODUCT.STATUS.NA()}</>;
  }
};
