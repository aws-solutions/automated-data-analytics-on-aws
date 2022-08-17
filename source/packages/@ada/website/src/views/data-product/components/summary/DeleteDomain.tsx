/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Button, Inline } from 'aws-northstar';
import { DataProduct, DomainEntity } from '@ada/api';
import {
  DeleteEntityButton,
  DeleteEntityButtonProps,
  DeleteEntityConfirmationDialog,
  OnDeleteEntityCallback,
} from '$common/components/DeleteEntity';
import { EntityString, useI18nContext } from '$strings';
import { apiHooks } from '$api';
import { useHistory } from 'react-router';
import { useNotificationContext } from '$northstar-plus';
import { useUserCanModifyEntity } from '$core/provider/UserProvider';
import React, { useCallback } from 'react';

const useDeleteContext = (entity?: DomainEntity) => {
  const allowDelete = useUserCanModifyEntity(entity, { operation: 'deleteDataProductDomain' });
  const [deleteOperation] = apiHooks.useDeleteDataProductDomainAsync();

  const identifier: DomainEntity | undefined = entity;
  const entityName = entity?.name;

  const onDelete = useCallback<OnDeleteEntityCallback>(async () => {
    if (identifier == null) throw new Error('Unspecified identifier to delete');

    await deleteOperation(identifier);

    return true;
  }, [deleteOperation, identifier]);

  return {
    identifier,
    entityName,
    allowDelete,
    onDelete,
  };
};

export const DeleteDomainButton: React.FC<
  {
    domain?: DomainEntity;
    dataProducts?: DataProduct[];
  } & Pick<DeleteEntityButtonProps, 'buttonSize' | 'buttonVariant'>
> = ({ domain, dataProducts, ...buttonProps }) => {
  const props = useDeleteContext(domain);
  const { LL } = useI18nContext();
  const { addError } = useNotificationContext();
  const history = useHistory();

  const onDelete = () => {
    addError({
      header: LL.VIEW.DATA_PRODUCT.Domain.selector.delete.alertTitle({ name: domain!.name }),
      content: LL.VIEW.DATA_PRODUCT.Domain.selector.delete.hintText(),
      dismissible: 'auto',
    });
  };
  const onDeleted = () => {
    history.push('/');
  };
  if (props.allowDelete) {
    if (dataProducts?.length) {
      return (
        <Inline>
          <Button onClick={onDelete} aria-label="Delete Domain" variant="primary">
            {LL.ENTITY.Domain__DELETE()}
          </Button>
        </Inline>
      );
    }
    return (
      <DeleteEntityButton
        entityType={EntityString.Domain}
        navigateTo="/data-product/"
        {...buttonProps}
        {...props}
        deleteButtonText={LL.ENTITY.Domain__DELETE()}
        onDeleted={onDeleted}
      />
    );
  }

  return null;
};

export const DeleteDomainConfirmationDialog: React.FC<{
  domain?: DomainEntity;
  onClose: () => void;
}> = ({ domain, onClose }) => {
  const props = useDeleteContext(domain);

  return (
    <DeleteEntityConfirmationDialog
      entityType={EntityString.Domain}
      onClose={onClose}
      navigateTo="/data-product/"
      {...props}
    />
  );
};
