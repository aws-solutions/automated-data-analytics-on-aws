/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DeleteEntityButton, DeleteEntityButtonProps, OnDeleteEntityCallback } from '$common/components/DeleteEntity';
import { EntityString } from '$strings';
import { IdentityProviderEntity, IdentityProviderIdentifier } from '@ada/api';
import { apiHooks } from '$api';
import { useHistory } from 'react-router';
import { useUserCanModifyEntity } from '$core/provider/UserProvider';
import React, { useCallback } from 'react';

const useDeleteContext = (entity?: IdentityProviderEntity) => {
  const history = useHistory();
  const allowDelete = useUserCanModifyEntity(entity, { operation: 'deleteIdentityProvider' });
  const [deleteOperation] = apiHooks.useDeleteIdentityProviderAsync();

  const identifier: IdentityProviderIdentifier | undefined = entity;
  const entityName = entity?.name;

  const onDelete = useCallback<OnDeleteEntityCallback>(async () => {
    if (identifier == null) throw new Error('Unspecified identifier to delete');

    await deleteOperation(identifier);

    history.goBack();

    return true;
  }, [deleteOperation, identifier, history]);

  return {
    identifier,
    entityName,
    allowDelete,
    onDelete,
  };
};

export const DeleteIdentityProviderButton: React.FC<
  {
    identityProvider?: IdentityProviderEntity;
  } & Pick<DeleteEntityButtonProps, 'buttonSize' | 'buttonVariant'>
> = ({ identityProvider, ...buttonProps }) => {
  const props = useDeleteContext(identityProvider);

  return (
    <DeleteEntityButton
      entityType={EntityString.IdentityProvider}
      navigateTo="/admin/identity/provider/"
      {...buttonProps}
      {...props}
    />
  );
};
