/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DeleteEntityButton, DeleteEntityButtonProps, OnDeleteEntityCallback } from '$common/components/DeleteEntity';
import { EntityString } from '$strings';
import { GroupEntity, GroupIdentifier } from '@ada/api';
import { apiHooks } from '$api';
import { useUserCanModifyEntity } from '$core/provider/UserProvider';
import React, { useCallback } from 'react';

const useDeleteContext = (entity?: GroupEntity) => {
  const allowDelete = useUserCanModifyEntity(entity, { operation: 'deleteIdentityGroup' });
  const [deleteOperation] = apiHooks.useDeleteIdentityGroupAsync();

  const identifier: GroupIdentifier | undefined = entity;
  const entityName = entity?.groupId;

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

export const DeleteGroupButton: React.FC<
  {
    group?: GroupEntity;
  } & Pick<DeleteEntityButtonProps, 'buttonSize' | 'buttonVariant'>
> = ({ group, ...buttonProps }) => {
  const props = useDeleteContext(group);

  return (
    <DeleteEntityButton
      entityType={EntityString.Group}
      navigateTo="/groups"
      {...buttonProps}
      {...props}
    />
  );
};
