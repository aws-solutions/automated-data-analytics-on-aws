/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Alert, Paper, StatusIndicator, Tabs } from 'aws-northstar';
import { DataProductSourceDataStatus } from '@ada/common';
import { LLSafeHtmlBlock, useI18nContext } from '$strings';
import { Permisssions } from './Permissions';
import { SchemaRenderer } from './schema/SchemaRenderer';
import { useDataProductContext } from '../context/DataProductContext';
import React from 'react';

export const DataProductRelatedResources: React.FC = () => {
  const { LL } = useI18nContext();
  const { dataProduct, dataProductState, isDataProductOwner } = useDataProductContext();

  return (
    <>
      {isDataProductOwner && <QueryableSourceInfo />}

      <Tabs
        paddingContentArea={false}
        tabs={[
          {
            id: 'schema',
            label: LL.VIEW.DATA_PRODUCT.SCHEMA.title(),
            content: dataProductState.hasSchema ? (
              <SchemaRenderer entity={dataProduct} />
            ) : (
              <Paper variant="outlined" style={{ padding: 10 }}>
                <StatusIndicator statusType="info">
                  {LL.VIEW.DATA_PRODUCT.SCHEMA.PROGRESS.generatingText()}
                </StatusIndicator>
              </Paper>
            ),
          },
          {
            id: 'permissions',
            label: LL.VIEW.DATA_PRODUCT.PERMISSIONS.title(),
            content: <Permisssions />,
          },
          // TODO: Re-enable when bug with default lenses is fixed! Also consider merging with permissions above?
          // {
          //   id: 'defaultLenses',
          //   label: 'Default Lenses',
          //   content: (
          //     <DataProductDefaultLenses
          //       dataProductDefaultLenses={dataProductDefaultLenses}
          //       groups={groups}
          //       onSaveDataProductDefaultLenses={onSaveDataProductDefaultLenses}
          //     />
          //   ),
          // },
        ]}
      />
    </>
  );
};

const QueryableSourceInfo: React.FC = () => {
  const { LL } = useI18nContext();
  const { dataProduct, dataProductState: state, isDataProductOwner, sourceSqlIdentifier } = useDataProductContext();

  if (!isDataProductOwner || dataProduct == null) {
    return null;
  }

  if (!state.isSourceDataSupported) {
    return <Alert type="info">{LL.VIEW.DATA_PRODUCT.sourceDataMessage.notSupported()}</Alert>;
  }

  if (state.isReady) {
    // Data is ready - only show source messaging is in ready state as well
    if (state.source.status === DataProductSourceDataStatus.READY) {
      return (
        <Alert type="info" header={LL.VIEW.DATA_PRODUCT.sourceDataMessage.state.dataAndSourceReady.header()}>
          <LLSafeHtmlBlock
            string="VIEW.DATA_PRODUCT.sourceDataMessage.state.dataAndSourceReady.messageHtml"
            args={[{ sqlIndetifier: sourceSqlIdentifier }]}
          />
        </Alert>
      );
    } else {
      return null;
    }
  } else {
    // Data is NOT ready, show details about using source while data is processing
    switch (state.source.status) {
      case DataProductSourceDataStatus.NO_DATA:
      case DataProductSourceDataStatus.UPDATING: {
        return (
          <Alert type="info" header={LL.VIEW.DATA_PRODUCT.sourceDataMessage.state.PENDING.header()}>
            <LLSafeHtmlBlock
              string="VIEW.DATA_PRODUCT.sourceDataMessage.state.PENDING.messageHtml"
              args={[{ sqlIndetifier: sourceSqlIdentifier }]}
            />
          </Alert>
        );
      }
      case DataProductSourceDataStatus.FAILED: {
        return (
          <Alert type="warning" header={LL.VIEW.DATA_PRODUCT.sourceDataMessage.state.FAILED.header()}>
            <LLSafeHtmlBlock string="VIEW.DATA_PRODUCT.sourceDataMessage.state.FAILED.messageHtml" />
            <pre>{state.source.details}</pre>
          </Alert>
        );
      }
      case DataProductSourceDataStatus.READY: {
        return (
          <Alert type="info" header={LL.VIEW.DATA_PRODUCT.sourceDataMessage.state.READY.header()}>
            <LLSafeHtmlBlock
              string="VIEW.DATA_PRODUCT.sourceDataMessage.state.READY.messageHtml"
              args={[{ sqlIndetifier: sourceSqlIdentifier }]}
            />
          </Alert>
        );
      }
      default: {
        return null;
      }
    }
  }
};
