/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AllDomainsDataProductTable, DomainDataProductTable } from '../../components/tables';
import { AlllDomainsSummary } from '../../components/summary/AllDomainsSummary';
import { DomainSelector as BaseDomainSelector } from '../../components/control/DomainSelector';
import { BaseTableProps } from '$common/components/tables';
import { Box, Button, Heading, Inline, Stack, Theme, makeStyles } from 'aws-northstar';
import { DataProductEntity, DomainEntity } from '@ada/api';
import { DomainSummary } from '../../components/summary/DomainSummary';
import { ManagedHelpPanel, PageLayout } from '$northstar-plus';
import { useHistory, useParams } from 'react-router-dom';
import { useI18nContext } from '$strings';
import { useOperationAllowed } from '$api/hooks/permissions';
import React, { useCallback, useMemo } from 'react';
import clsx from 'clsx';

interface Params {
  domainId?: string;
}

export interface DataProductRootViewProps {}

export const DataProductRootView: React.FC<DataProductRootViewProps> = () => {
  const { LL } = useI18nContext();
  const history = useHistory();
  const { domainId } = useParams<Params>();
  const allowCreate = useOperationAllowed('postDataProductDomainDataProduct');

  const onCreateNew = useCallback(() => {
    if (domainId) {
      history.push(`/data-product/${domainId}/new`);
    } else {
      history.push(`/data-product/new`);
    }
  }, [domainId, history]);

  const tableProps = useMemo<Partial<BaseTableProps<DataProductEntity>>>(() => {
    return {
      actionGroup: (
        <Inline>
          <Button variant="primary" onClick={allowCreate ? onCreateNew : undefined} disabled={!allowCreate}>
            {LL.ENTITY.DataProduct__CREATE()}
          </Button>
        </Inline>
      ),
    };
  }, [onCreateNew, allowCreate]);

  return (
    <PageLayout
      title={LL.VIEW.DATA_PRODUCT.ROOT.title()}
      subtitle={LL.VIEW.DATA_PRODUCT.ROOT.subtitle()}
      actionButtons={<DomainSelector domainId={domainId} />}
    >
      <HelpInfo />

      {domainId ? (
        <Stack>
          <DomainSummary domainId={domainId} />
          <DomainDataProductTable domainId={domainId} {...tableProps} />
        </Stack>
      ) : (
        <Stack>
          <AlllDomainsSummary />
          <AllDomainsDataProductTable {...tableProps} />
        </Stack>
      )}
    </PageLayout>
  );
};

const DomainSelector: React.FC<{ domainId?: string }> = ({ domainId }) => {
  const { LL } = useI18nContext();
  const classes = useStyles();
  const history = useHistory();
  const onSelect = useCallback(
    (domain: DomainEntity) => {
      history.push(`/data-product/${domain.domainId}`);
    },
    [history],
  );

  return (
    <Box className={clsx(classes.domainSelectorContainter)}>
      <Heading variant="h5">{LL.ENTITY.Domain()}</Heading>
      <BaseDomainSelector currentDomainId={domainId} onSelect={onSelect} enableCreate includeAll />
    </Box>
  );
};

const useStyles = makeStyles<Theme>(() => ({
  // TODO: [UX] improve alignment of domain selector dropdown
  domainSelectorContainter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyItems: 'stretch',
    '& > *': {
      flex: '1',
    },
  },
}));

const HelpInfo = () => {
  const { LL } = useI18nContext();

  return (
    <ManagedHelpPanel header={LL.VIEW.DATA_PRODUCT.HELP.ROOT.header()}>
      {import('@ada/strings/markdown/view/data-product/help.md')}
    </ManagedHelpPanel>
  );
}
