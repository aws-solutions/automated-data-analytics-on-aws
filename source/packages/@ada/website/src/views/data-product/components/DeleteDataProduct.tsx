/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductEntity, DataProductIdentifier } from '@ada/api';
import {
  DeleteEntityButton,
  DeleteEntityButtonDropdownItemDialogProps,
  DeleteEntityButtonProps,
  DeleteEntityConfirmationDialog,
  OnDeleteEntityCallback,
  useDeleteEntityButtonDropdownItem,
} from '$common/components/DeleteEntity';
import { EntityString } from '$strings';
import { apiHooks } from '$api';
import { useUserCanModifyEntity } from '$core/provider/UserProvider';
import React, { useCallback, useMemo } from 'react';

const useDeleteContext = (entity?: DataProductEntity) => {
  const allowDelete = useUserCanModifyEntity(entity, { operation: 'deleteDataProductDomainDataProduct' });
  const [deleteOperation] = apiHooks.useDeleteDataProductDomainDataProductAsync();

  const identifier: DataProductIdentifier | undefined = entity;
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

export const DeleteDataProductButton: React.FC<
  {
    dataProduct?: DataProductEntity;
  } & Pick<DeleteEntityButtonProps, 'buttonSize' | 'buttonVariant'>
> = ({ dataProduct, ...buttonProps }) => {
  const props = useDeleteContext(dataProduct);

  return (
    <DeleteEntityButton
      entityType={EntityString.DataProduct}
      navigateTo="/data-product/"
      {...buttonProps}
      {...props}
    />
  );
};

export const DeleteDataProductConfirmationDialog: React.FC<{
  dataProduct?: DataProductEntity;
  onClose: () => void;
}> = ({ dataProduct, onClose }) => {
  const props = useDeleteContext(dataProduct);

  return (
    <DeleteEntityConfirmationDialog
      entityType={EntityString.DataProduct}
      onClose={onClose}
      navigateTo="/data-product/"
      {...props}
    />
  );
};

export const useDeleteDataProductButtonDropdownItem = (dataProduct?: DataProductEntity) => {
  const props = useDeleteContext(dataProduct);

  const dialogProps = useMemo<DeleteEntityButtonDropdownItemDialogProps>(() => {
    return {
      entityType: EntityString.DataProduct,
      navigateTo: '/data-product/',
      ...props,
    };
  }, [props]);

  return useDeleteEntityButtonDropdownItem(dialogProps);
};
