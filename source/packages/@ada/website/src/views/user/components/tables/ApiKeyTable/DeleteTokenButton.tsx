/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  DeleteEntityButton,
  OnDeleteEntityCallback,
  ScopedDeleteEntityButtonProps,
} from '$common/components/DeleteEntity';
import { EntityString } from '$strings';
import { TokenEntity, TokenIdentifier } from '@ada/api';
import { apiHooks } from '$api';
import { useUserCanModifyEntity } from '$core/provider/UserProvider';
import React, { useCallback } from 'react';

const useDeleteContext = (entity?: TokenEntity) => {
  const allowDelete = useUserCanModifyEntity(entity, { operation: 'deleteIdentityMachineToken' });
  const [deleteOperation] = apiHooks.useDeleteIdentityMachineTokenAsync();

  const identifier: TokenIdentifier | undefined = entity;
  const entityName = entity?.tokenId;

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

export const DeleteTokenButton: React.FC<ScopedDeleteEntityButtonProps<TokenEntity, 'token'>> = ({
  token,
  ...buttonProps
}) => {
  const props = useDeleteContext(token);

  return <DeleteEntityButton entityType={EntityString.Token} {...buttonProps} {...props} />;
};
