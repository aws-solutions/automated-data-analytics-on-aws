/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Alert, Button, Container, Stack, Text } from 'aws-northstar';
import { CreateDomainDialog } from '../dialogs/CreateDomainDialog';
import { DefaultGroupIds } from '@ada/common';
import { Skeletons, SummaryRenderer } from '$northstar-plus';
import { apiHooks } from '$api';
import { useAllDataProducts } from '$views/data-product/hooks';
import { useHistory } from 'react-router-dom';
import { useI18nContext } from '$strings';
import { useOperationAllowed } from '$api/hooks/permissions';
import React, { useMemo, useState } from 'react';

export interface AlllDomainsSummaryProps {}

export const AlllDomainsSummary: React.FC<AlllDomainsSummaryProps> = () => {
  const { LL } = useI18nContext();
  const history = useHistory();
  const [domains, { isLoading }] = apiHooks.useAllDataProductDomains(undefined, { waitForAll: true });
  const totalDomains = domains && domains.length;
  const [dataProducts] = useAllDataProducts();
  const totalDataProducts = dataProducts && dataProducts.length;

  const noDomains = useMemo(() => {
    if (isLoading || domains == null) return null;
    return domains.length === 0;
  }, [domains, isLoading]);

  const [showCreateDialog, setShowCreateDialog] = useState<boolean>(false);

  const canCreateDomain = useOperationAllowed('putDataProductDomain');

  const createButton = useMemo<React.ReactNode>(() => {
    return (
      <>
        <Button
          variant="primary"
          disabled={!canCreateDomain}
          onClick={canCreateDomain ? () => setShowCreateDialog(true) : undefined}
        >
          {LL.ENTITY.Domain__CREATE()}
        </Button>
        {showCreateDialog && <CreateDomainDialog onClose={() => setShowCreateDialog(false)} />}
      </>
    );
  }, [canCreateDomain, showCreateDialog, setShowCreateDialog]);

  if (noDomains === true) {
    return (
      <Container title={LL.VIEW.DATA_PRODUCT.Domain.summary.none.title()} actionGroup={createButton}>
        <Stack spacing="l">
          <Text>{LL.VIEW.DATA_PRODUCT.Domain.summary.none.message()}</Text>

          {!canCreateDomain && (
            <Alert
              type="info"
              buttonText={LL.VIEW.DATA_PRODUCT.Domain.summary.none.permissions.buttonText()}
              onButtonClick={() => history.push(`/groups/${DefaultGroupIds.POWER_USER}`)}
            >
              {LL.VIEW.DATA_PRODUCT.Domain.summary.none.permissions.message()}
            </Alert>
          )}
        </Stack>
      </Container>
    );
  }

  if (domains == null) {
    return <Skeletons.Summary sections={1} />;
  }

  return (
    <SummaryRenderer
      sections={[
        {
          title: LL.VIEW.DATA_PRODUCT.Domain.summary.all.title(),
          subtitle: LL.VIEW.DATA_PRODUCT.Domain.summary.all.subtitle(),
          actionGroup: createButton,
          options: {
            columns: 2,
          },
          properties: {
            [LL.VIEW.DATA_PRODUCT.Domain.summary.all.totalDomains()]: totalDomains,
            [LL.VIEW.DATA_PRODUCT.Domain.summary.totalDataProducts()]: totalDataProducts,
          },
        },
      ]}
    />
  );
};
