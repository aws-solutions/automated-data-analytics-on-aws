/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  ButtonDropdown,
  ButtonDropdownProps,
  ManagedHelpPanel,
  PageLayout,
  PageNotFound,
  useNotificationContext,
} from '$northstar-plus';
import { DataProductContextProvider, useDataProductContext } from '../../context/DataProductContext';
import { DataProductIdentifier } from '@ada/api';
import { ErrorAlert } from '$common/components';
import { Inline, Link } from 'aws-northstar';
import { LLSafeHtmlString, useI18nContext } from '$strings';
import { DataProductRelatedResources as RelatedResources } from '../../components/RelatedResources';
import { DataProductSummary as Summary } from '../../components/summary/Summary';
import { identifierToName } from '$common/utils';
import { useDeleteDataProductButtonDropdownItem } from '$views/data-product/components/DeleteDataProduct';
import { useOpenDataProductInQueryWorkbench } from '../../hooks';
import { useParams } from 'react-router-dom';
import React, { useCallback, useMemo } from 'react';
import copyToClipboard from 'clipboard-copy';

export interface DataProductDetailViewProps {}

const BaseDataProductDetailView: React.FC = () => {
  const { LL } = useI18nContext();
  const { addBrief } = useNotificationContext();
  const { identifier, dataProduct, hasFailed, fetchError, notFound } = useDataProductContext();
  const { domainId, dataProductId } = identifier;

  const [deleteActionItem, deleteConfirmation] = useDeleteDataProductButtonDropdownItem(dataProduct);

  const openInQueryWorkbench = useOpenDataProductInQueryWorkbench(dataProduct);
  const shareHandler = useCallback(() => {
    copyToClipboard(window.location.href);
    addBrief({
      header: LL.VIEW.notify.brief.clipboard.success(),
      type: 'success',
    });
  }, [addBrief]);

  const actionButtons = useMemo<React.ReactNode>(() => {
    const actions: ButtonDropdownProps['items'] = [
      {
        text: LL.VIEW.DATA_PRODUCT.ACTIONS.query.text(),
        disabled: openInQueryWorkbench == null,
        onClick: openInQueryWorkbench,
      },
      {
        text: LL.VIEW.DATA_PRODUCT.ACTIONS.share.text(),
        disabled: openInQueryWorkbench == null,
        onClick: shareHandler,
      },
    ];

    if (deleteActionItem) {
      actions.push(deleteActionItem);
    }

    return (
      <Inline>
        <ButtonDropdown content={LL.VIEW.DATA_PRODUCT.ACTIONS.title()} items={actions} />
      </Inline>
    );
  }, [openInQueryWorkbench, deleteActionItem]);

  if (hasFailed) {
    if (notFound) {
      return (
        <PageNotFound
          description={
            <>
              <LLSafeHtmlString string="VIEW.DATA_PRODUCT.NOT_FOUND_HTML.description" args={[{ domainId, dataProductId }]} />
              <pre>{fetchError?.message}</pre>
            </>
          }
          destinationLinks={[
            <Link key="0" href={`/data-product/${domainId}`}>
              <LLSafeHtmlString string="VIEW.DATA_PRODUCT.NOT_FOUND_HTML.seeAllInDomainLink" args={[{ domainId }]} />
            </Link>,
            <Link key="1" href="/data-product">
              <LLSafeHtmlString string="VIEW.DATA_PRODUCT.NOT_FOUND_HTML.seeAllLink" />
            </Link>,
          ]}
        />
      );
    }

    return (
      <ErrorAlert
        header={LL.VIEW.notify.error.load({
          entity: LL.ENTITY.DataProduct(),
          name: identifierToName(dataProductId),
        })}
        error={fetchError}
      />
    );
  }

  return (
    <PageLayout
      isLoading={dataProduct == null}
      title={dataProduct?.name}
      subtitle={dataProduct?.description}
      actionButtons={actionButtons}
    >
      <HelpInfo />
      <Summary />
      <RelatedResources />

      {deleteConfirmation}
    </PageLayout>
  );
};

export const DataProductDetailView: React.FC<DataProductDetailViewProps> = () => {
  const { domainId, dataProductId } = useParams<{ domainId: string; dataProductId: string }>();
  const identifier = useMemo<DataProductIdentifier>(() => {
    return { domainId, dataProductId };
  }, [domainId, dataProductId]);

  return (
    <DataProductContextProvider identifier={identifier}>
      <BaseDataProductDetailView />
    </DataProductContextProvider>
  );
};

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.DATA_PRODUCT.HELP.DETAIL.header()}>
      {import('@ada/strings/markdown/view/data-product/help.detail.md')}
    </ManagedHelpPanel>
  );
}
