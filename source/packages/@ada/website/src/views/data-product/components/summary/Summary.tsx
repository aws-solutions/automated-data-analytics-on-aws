/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Button, Inline, StatusIndicator, Text } from 'aws-northstar';
import { ContainerProps } from 'aws-northstar/layouts/Container';
import { DataProductState } from '$views/data-product/common';
import { EntityCreatedKV } from '$common/components';
import { NO_REFRESH_OPTIONS, apiHooks } from '$api';
import { RelativeDate, TagGroup, useNotificationContext } from '$northstar-plus';
import { SourceDetailsRenderer } from '../SourceDetailsRenderer';
import { SourceTypeBadge } from '$connectors/icons';
import { Status } from '../Status';
import { SummaryRenderer } from '$northstar-plus/components/SummaryRenderer';
import { getDataProductSQLIdentitier } from '$common/utils';
import { isEmpty, startCase } from 'lodash';
import { useDataProductContext } from '$views/data-product/context/DataProductContext';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import React, { useCallback, useMemo, useState } from 'react';
import type { DataProductEntity } from '@ada/api';

/* eslint-disable sonarjs/no-duplicate-string */

export const DataProductSummary: React.FC = () => {
  const { LL } = useI18nContext();
  const { addSuccess, addError } = useNotificationContext();
  const { identifier, dataProduct, dataProductState, isUserAllowedToEdit, refetchDataProductState, isLoading } =
    useDataProductContext();

  const [startDataUpdateMutation] = apiHooks.usePutDataProductDomainDataProductStartDataUpdateAsync();
  const [triggerUpdateInProgress, setTriggerUpdateInProgress] = useState(false);
  const startDataUpdate = useCallback(async () => {
    try {
      setTriggerUpdateInProgress(true);
      await startDataUpdateMutation(identifier);
      await refetchDataProductState();
      addSuccess({
        header: LL.VIEW.DATA_PRODUCT.TRIGGER.notify.TRIGGERED_UPDATED.header(),
        content: LL.VIEW.DATA_PRODUCT.TRIGGER.notify.TRIGGERED_UPDATED.content(),
      });
    } catch (error: any) {
      console.error('Failed to trigger data update', error);
      addError({
        header: LL.VIEW.DATA_PRODUCT.TRIGGER.notify.FAILED_TO_TRIGGERED_UPDATE.header(),
        content: error.message,
      });
    } finally {
      setTriggerUpdateInProgress(false);
    }
  }, [identifier, startDataUpdateMutation, refetchDataProductState, addError, addSuccess]);

  const actionGroup = useMemo<React.ReactNode>(() => {
    if (dataProductState.onDemandUpdateSupported && isUserAllowedToEdit) {
      return (
        <Button
          type="button"
          variant="primary"
          onClick={startDataUpdate}
          loading={triggerUpdateInProgress}
          disabled={triggerUpdateInProgress || !dataProductState.onDemandUpdateAvailable}
        >
          Trigger update
        </Button>
      );
    }
    return null;
  }, [dataProductState, isUserAllowedToEdit, startDataUpdate, triggerUpdateInProgress]);

  if (isLoading || dataProduct == null) {
    // parent will handling loading state
    return null;
  }

  return (
    <DataProductSummaryRenderer {...dataProduct} state={dataProductState} actionGroup={actionGroup} title="Details" />
  );
};

export interface DataProductSummaryRendererProps
  extends Pick<
    DataProductEntity,
    | 'domainId'
    | 'dataProductId'
    | 'enableAutomaticPii'
    | 'sourceType'
    | 'sourceDetails'
    | 'tags'
    | 'updateTrigger'
    | 'latestDataUpdateTimestamp'
    | 'transforms'
    | 'createdBy'
    | 'createdTimestamp'
  > {
  title?: string;
  subtitle?: string;
  actionGroup?: ContainerProps['actionGroup'];
  state?: DataProductState;
  sourceDetailsCollapsible?: boolean;
  hideDates?: boolean;
}

export const DataProductSummaryRenderer: React.FC<DataProductSummaryRendererProps> = ({
  domainId,
  dataProductId,
  enableAutomaticPii,
  sourceType,
  sourceDetails,
  tags = [],
  updateTrigger,
  latestDataUpdateTimestamp,
  transforms,
  createdBy,
  createdTimestamp,

  title,
  subtitle,
  state,
  actionGroup,
  sourceDetailsCollapsible,
  hideDates,
}) => {
  const { LL } = useI18nContext();
  const sqlIdentifier = getDataProductSQLIdentitier({ domainId, dataProductId });
  const [scripts] = apiHooks.useAllDataProductScripts({}, { waitForAll: true, ...NO_REFRESH_OPTIONS });

  return (
    <>
      <SummaryRenderer
        sections={[
          {
            title,
            subtitle,
            actionGroup,
            properties: [
              // column 1
              [
                {
                  label: LL.ENTITY.DataProduct_.identifier.label(),
                  value: sqlIdentifier,
                },
                state && {
                  label: LL.ENTITY.DataProduct_.status.label(),
                  value: <Status detailed {...state} />,
                },
                {
                  label: LL.ENTITY['DataProduct@'].enableAutomaticPii.label(),
                  value: (
                    <StatusIndicator statusType={enableAutomaticPii ? 'positive' : 'negative'}>
                      {enableAutomaticPii ? 'Yes' : 'No'}
                    </StatusIndicator>
                  ),
                },
              ],
              // column 2
              [
                {
                  label: LL.ENTITY['DataProduct@'].sourceType.label(),
                  value: <SourceTypeBadge sourceType={sourceType} />,
                },
                updateTrigger && {
                  label: LL.ENTITY['DataProduct@'].updateTrigger.label(),
                  value: (
                    <Inline spacing="xs">
                      <Text>{startCase(updateTrigger.triggerType)}</Text>
                      {updateTrigger.scheduleRate && <Text variant="small">{updateTrigger.scheduleRate}</Text>}
                    </Inline>
                  ),
                },
                {
                  label: LL.ENTITY['DataProduct@'].transforms.label(),
                  value: isEmpty(transforms) ? null : (
                    <ol>
                      {transforms.map((t) => {
                        const id = `${t.namespace}.${t.scriptId}`;
                        const script = scripts?.find((_script) => {
                          return _script.namespace === t.namespace && _script.scriptId === t.scriptId;
                        })
                        return <li key={id}>{script?.name || id}</li>;
                      })}
                    </ol>
                  ),
                },
                {
                  label: LL.ENTITY['DataProduct@'].tags.label(),
                  value: <TagGroup tags={tags as any} />,
                },
              ],
              // column 3
              [
                ...(hideDates === true
                  ? null
                  : ([
                      {
                        label: LL.ENTITY['DataProduct@'].latestDataUpdateTimestamp.label(),
                        value: latestDataUpdateTimestamp && (
                          <RelativeDate date={latestDataUpdateTimestamp} tooltipHeader="Last data update timestamp" />
                        ),
                      },
                      createdBy &&
                        ({
                          value: <EntityCreatedKV entity={{ createdBy, createdTimestamp }} />,
                        } as any),
                    ] as any)),
                {
                  label: LL.ENTITY['DataProduct@'].tags.label(),
                  value: <TagGroup tags={tags as any} />,
                },
              ],
            ],
          },
        ]}
      />
      <SourceDetailsRenderer
        sourceType={sourceType as any}
        sourceDetails={sourceDetails as any}
        collapsible={sourceDetailsCollapsible}
      />
    </>
  );
};
