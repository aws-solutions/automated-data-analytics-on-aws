/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductEntity } from '@ada/api';
import { DataProductLink } from '$common/entity/data-product';
import { DeleteDomainButton } from './DeleteDomain';
import { Inline } from 'aws-northstar';
import { PLACEHOLDERS } from '$views/data-product/common';
import { RelativeDate, Skeletons, SummaryRenderer, useNotificationContext } from '$northstar-plus';
import { UserLink } from '$common/entity/user';
import { apiHooks } from '$api';
import { entitySummarySectionProperty } from '$common/components';
import { isNotFoundError } from '$common/utils';
import { useHistory } from 'react-router-dom';
import { useI18nContext } from '$strings';
import React, { useCallback, useMemo } from 'react';
import moment from 'moment';

export interface DomainSummaryProps {
  domainId: string;
}

export const DomainSummary: React.FC<DomainSummaryProps> = ({ domainId }) => {
  const { LL } = useI18nContext();
  const history = useHistory();
  const { addError } = useNotificationContext();
  const [domain] = apiHooks.useDataProductDomain(
    { domainId },
    {
      onError: useCallback(
        (error) => {
          if (isNotFoundError(error)) {
            addError({
              header: LL.VIEW.error.notFound(),
              content: error.message,
            });
            history.push('/data-product');
          } else {
            addError({
              header: LL.ENTITY.Domains__FAILED_TO_FETCH(),
              content: error.message,
            });
          }
        },
        [addError, history],
      ),
      placeholderData: PLACEHOLDERS.Domain,
    },
  );
  const [dataProducts, { isLoading: isLoadingDP }] = apiHooks.useAllDataProductDomainDataProducts({ domainId });
  const totalDataProducts = dataProducts && dataProducts.length;
  const latestCreated = (dataProducts || []).reduce((latest, entity) => {
    if (latest == null) return entity;
    if (moment(latest.createdTimestamp).isBefore(moment(entity.createdTimestamp))) return entity;
    return latest;
  }, null as DataProductEntity | null);

  /*
   * delete button
   * alert button is an intermediate solution to request user to delete dp before deleting a domain
   * this is to be replaced by deleting dps within a domain automatically
   */
  const deleteButton = useMemo<React.ReactNode>(() => {
    if (isLoadingDP) {
      return null;
    } else {
      return (
        <Inline>
          <DeleteDomainButton domain={domain} dataProducts={dataProducts} buttonVariant="primary" />
        </Inline>
      );
    }
  }, [isLoadingDP, domain, dataProducts]);

  if (domain == null) {
    return <Skeletons.Summary sections={1} />;
  }

  return (
    <SummaryRenderer
      sections={[
        {
          title: LL.VIEW.DATA_PRODUCT.Domain.summary.domain.title({ domain: domainId }),
          subtitle: LL.VIEW.DATA_PRODUCT.Domain.summary.domain.subtitle(),
          actionGroup: deleteButton,
          properties: [
            [
              {
                label: LL.ENTITY.SqlIdentifier.label(),
                value: LL.ENTITY.SqlIdentifier.value(domainId),
              },
              {
                label: LL.CONST.OWNER(),
                value: <UserLink user={domain?.createdBy} />,
              },
            ],
            [
              {
                label: LL.VIEW.DATA_PRODUCT.Domain.summary.totalDataProducts(),
                value: totalDataProducts,
              },
              {
                label: LL.VIEW.DATA_PRODUCT.Domain.summary.domain.lastCreated(),
                value: latestCreated && (
                  <Inline spacing="xs">
                    <DataProductLink dataProduct={latestCreated} />{' '}
                    <RelativeDate date={latestCreated?.createdTimestamp} tooltip={false} />
                  </Inline>
                ),
              },
            ],
            [entitySummarySectionProperty({ entity: domain })],
          ],
        },
      ]}
    />
  );
};
