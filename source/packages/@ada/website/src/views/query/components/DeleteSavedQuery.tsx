/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { EntityString } from '$strings';
import { OnDeleteEntityCallback, useDeleteEntityButtonDropdownItem } from '$common/components/DeleteEntity';
import { SavedQueryEntity, SavedQueryIdentifier } from '@ada/api';
import { apiHooks, useApiInvalidation } from '$api';
import { useUserCanModifyEntity } from '$core/provider/UserProvider';
import React, { useCallback } from 'react';

const useDeleteContext = (entity?: SavedQueryEntity) => {
  const allowDelete = useUserCanModifyEntity(entity, { operation: 'deleteQuerySavedQuery' });
  const { invalidateEntityLists } = useApiInvalidation();
  const [deleteOperation] = apiHooks.useDeleteQuerySavedQueryAsync({
    onSuccess: () => {
      invalidateEntityLists('QuerySavedQuery');
      invalidateEntityLists('QueryNamespaceSavedQuery');
    },
  });

  const identifier: SavedQueryIdentifier | undefined = entity;
  const entityName = entity?.queryId;

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

export const useDeleteSavedQueryButtonDropdownItem = (savedQuery?: SavedQueryEntity) => {
  const props = useDeleteContext(savedQuery);

  return useDeleteEntityButtonDropdownItem({
    entityType: EntityString.SavedQuery,
    ...props,
  });
};
