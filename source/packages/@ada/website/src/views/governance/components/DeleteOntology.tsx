/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DeleteEntityButton, DeleteEntityButtonProps, OnDeleteEntityCallback } from '$common/components/DeleteEntity';
import { EntityString } from '$strings';
import { OntologyEntity, OntologyIdentifier } from '@ada/api';
import { apiHooks } from '$api';
import { useUserCanModifyEntity } from '$core/provider/UserProvider';
import React, { useCallback } from 'react';

const useDeleteContext = (entity?: OntologyEntity) => {
  const allowDelete = useUserCanModifyEntity(entity, { operation: 'deleteOntology' });
  const [deleteOperation] = apiHooks.useDeleteOntologyAsync();

  const identifier: OntologyIdentifier | undefined = entity;
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

export const DeleteOntologyButton: React.FC<
  {
    ontology?: OntologyEntity;
  } & Pick<DeleteEntityButtonProps, 'buttonSize' | 'buttonVariant'>
> = ({ ontology, ...buttonProps }) => {
  const props = useDeleteContext(ontology);

  return (
    <DeleteEntityButton
      entityType={EntityString.Ontology}
      navigateTo="/governance/"
      {...buttonProps}
      {...props}
    />
  );
};
