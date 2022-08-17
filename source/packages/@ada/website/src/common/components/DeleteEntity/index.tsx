/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Alert, Button, Stack } from 'aws-northstar';
import { ApiError } from '@ada/api';
import { ButtonDropdownItem, useNotificationContext } from '$northstar-plus';
import { ButtonProps } from 'aws-northstar/components/Button';
import { EntityString, LLSafeHtmlString, asStringEntityEventKey, useI18nContext } from '$strings';
import { Portal } from '@material-ui/core';
import { snakeCase } from 'lodash';
import { useHistory } from 'react-router';
import { useModalRoot } from '$common/hooks/use-dom-node';
import DeleteConfirmationDialog from 'aws-northstar/advanced/DeleteConfirmationDialog';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

type OnDeleteEntityResolved = true;
type OnDeleteEntityRejected = ApiError | Error;

export interface OnDeleteEntityCallback {
  (): Promise<OnDeleteEntityResolved | OnDeleteEntityRejected>;
}

export interface DeleteEntityConfirmationDialogProps {
  /** The type of entity as mapped in `@ada/strings`. */
  entityType: EntityString;
  /** Name of the entity being deleted. If undefined, dialog will not be visible. */
  entityName?: string;

  /** Indicates if the user has permission to delete. If `false`, the dialog will not be visible */
  allowDelete: boolean;

  /** Explicit title to use for delete dialog. @default {string} Inferred from entity type/name */
  title?: string;
  /** Explicit warning message to use for delete dialog. @default {string} Inferred from entity type/name */
  warning?: React.ReactNode;

  /** Disables the with friction and uses confirmation only @default false - defaults to using friction */
  withoutFriction?: boolean;

  /** Text user must enter to confirm deletion. @default "delete" */
  confirmationText?: string;

  /** The path to navigate to after successful delete */
  navigateTo: string;

  onDelete: OnDeleteEntityCallback;

  onDeleted?: () => void;

  onClose?: () => void;
}

export const DeleteEntityConfirmationDialog: React.FC<DeleteEntityConfirmationDialogProps> = ({
  onDelete,
  onDeleted,
  onClose,
  navigateTo,
  entityName,
  entityType,
  allowDelete,
  title,
  warning,
  withoutFriction = false,
  confirmationText,
}) => {
  const { LL } = useI18nContext();
  const history = useHistory();
  const { addSuccess } = useNotificationContext();
  const [visible, setVisible] = useState(true);
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);
  const [error, setError] = useState<React.ReactNode>();

  // get the lowcase dictionary string for this entity type
  let entityTypeLowerCaseStr = entityType as string;
  const entity_type = snakeCase(entityType) as keyof typeof LL.ENTITY;
  if (entity_type in LL.ENTITY) {
    // @ts-ignore
    entityTypeLowerCaseStr = LL.ENTITY[entity_type]();
  }

  const deleteHandler = useCallback(async () => {
    try {
      setIsProcessingDelete(true);
      setError(undefined);
      const result = await onDelete();
      if (result !== true) {
        throw new Error('Delete failed without explicit error');
      }

      addSuccess({
        header: LL.ENTITY[asStringEntityEventKey(`${entityType}__DELETED`)](),
        content: entityName,
      });

      setVisible(false);

      onDeleted && onDeleted();

      history.push(navigateTo);
    } catch (_error: any) {
      console.warn(`Failed to delete ${entityTypeLowerCaseStr} "${entityName}"`, _error);
      setError(
        <Alert type="error" header={LL.ENTITY[asStringEntityEventKey(`${entityType}__FAILED_TO_DELETE`)](entityName!)}>
          {_error.message || String(_error)}
        </Alert>,
      );
    } finally {
      setIsProcessingDelete(false);
    }
  }, [onDelete, onDeleted, addSuccess, setError, entityTypeLowerCaseStr, entityType, entityName]);

  const cancelHandler = useCallback(() => {
    setVisible(false);
  }, [setVisible]);

  useEffect(() => {
    if (visible === false) {
      onClose && onClose();
    }
  }, [visible]); // eslint-disable react-hooks/exhaustive-deps

  if (allowDelete !== true || entityName == null) {
    return null;
  }

  if (title == null) {
    title = LL.VIEW.action.deleteEntity.title({ entityType: entityTypeLowerCaseStr, entityName });
  }

  if (warning == null) {
    warning = (
      <LLSafeHtmlString
        string="VIEW.action.deleteEntity.HTML.warning"
        args={[{ entityType: entityTypeLowerCaseStr, entityName }]}
      />
    );
  }

  if (confirmationText == null) {
    confirmationText = LL.VIEW.action.deleteEntity.confirmationText();
  }

  const label = withoutFriction ? undefined : (
    <LLSafeHtmlString string="VIEW.action.deleteEntity.HTML.confirmationLabel" args={[{ confirmationText }]} />
  );

  return (
    <DeleteConfirmationDialog
      visible={visible}
      enabled={!isProcessingDelete}
      loading={isProcessingDelete}
      title={title!}
      confirmationText={confirmationText}
      label={label}
      variant={withoutFriction ? 'confirmation' : 'friction'}
      onDeleteClicked={isProcessingDelete ? undefined : deleteHandler}
      onCancelClicked={isProcessingDelete ? undefined : cancelHandler}
    >
      <Stack spacing="l">
        <Alert type="warning">{warning}</Alert>
        {error}
      </Stack>
    </DeleteConfirmationDialog>
  );
};

export interface DeleteEntityButtonProps extends DeleteEntityConfirmationDialogProps {
  allowDelete: boolean;
  buttonVariant?: ButtonProps['variant'];
  buttonSize?: ButtonProps['size'];
  /** Delete button text @default "Delete" */
  deleteButtonText?: string;
}

export type ScopedDeleteEntityButtonProps<T, TK extends string> = Omit<
  DeleteEntityButtonProps,
  'entityType' | 'onDelete' | 'allowDelete' | 'onClose'
> &
  Record<TK, T>;

export const DeleteEntityButton: React.FC<DeleteEntityButtonProps> = ({
  deleteButtonText,
  buttonVariant,
  buttonSize,
  onClose,
  ...props
}) => {
  const { LL } = useI18nContext();
  const [isConfirming, setIsConfirming] = useState(false);
  const { allowDelete, entityName } = props;

  const closeHandler = useCallback(() => {
    setIsConfirming(false);
    onClose && onClose();
  }, [onClose]);

  const modalRoot = useModalRoot();

  if (entityName == null) {
    return null;
  }

  return (
    <>
      <Button
        variant={buttonVariant}
        size={buttonSize}
        disabled={!allowDelete}
        onClick={allowDelete ? () => setIsConfirming(true) : undefined}
      >
        {deleteButtonText || LL.VIEW.action.deleteEntity.buttonText()}
      </Button>

      {allowDelete && isConfirming && (
        <Portal container={modalRoot}>
          <DeleteEntityConfirmationDialog {...props} onClose={closeHandler} />
        </Portal>
      )}
    </>
  );
};

export type DeleteEntityButtonDropdownItemProps = Omit<ButtonDropdownItem, 'onClick' | 'items'>;

export type DeleteEntityButtonDropdownItemDialogProps = DeleteEntityConfirmationDialogProps;

export const useDeleteEntityButtonDropdownItem = (
  dialogProps: Partial<DeleteEntityButtonDropdownItemDialogProps>,
  itemProps?: DeleteEntityButtonDropdownItemProps,
): [ButtonDropdownItem | undefined, React.ReactNode | undefined] => {
  const { onClose, ...props } = dialogProps;

  const { LL } = useI18nContext();
  const [isConfirming, setIsConfirming] = useState(false);

  const closeHandler = useCallback(() => {
    setIsConfirming(false);
    onClose && onClose();
  }, [onClose]);

  const item = useMemo<ButtonDropdownItem>(() => {
    return {
      text: LL.VIEW.action.deleteEntity.buttonText(),
      ...itemProps,
      onClick: () => setIsConfirming(true),
    };
  }, [itemProps]);

  const dialog = useMemo<React.ReactNode>(() => {
    // entityName maybe be undefined during initial hook render
    if (isConfirming && props.entityName != null) {
      return (
        <DeleteEntityConfirmationDialog {...(props as DeleteEntityConfirmationDialogProps)} onClose={closeHandler} />
      );
    }

    return null;
  }, [isConfirming]);

  if (props.allowDelete !== true || props.entityName == null) {
    return [undefined, undefined];
  }

  return [item, dialog];
};
