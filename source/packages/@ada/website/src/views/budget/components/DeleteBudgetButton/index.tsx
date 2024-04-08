/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Button, DeleteConfirmationDialog } from 'aws-northstar';
import { LLSafeHtmlString, useI18nContext } from '$strings';
import { apiHooks } from '$api';
import { useCallback, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useNotificationContext } from '$northstar-plus';

export const DeleteBudgetButton: React.FC = () => {
  const { LL } = useI18nContext();
  const history = useHistory();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { addSuccess, addError } = useNotificationContext();

  const handleDeleted = useCallback(() => {
    window.setTimeout(() => {
      history.go(0);
    }, 2000);
  }, []);

  const onError = useCallback(
    (error) => {
      setIsProcessing(false);
      setShowConfirm(false);
      addError({
        header: LL.VIEW.BUDGET.DELETE.NOTIFY.error.header(),
        content: error.message,
      });
    },
    [],
  );

  const onSuccess = useCallback(
    () => {
      setIsProcessing(false);
      setShowConfirm(false);
      addSuccess({
        header: LL.VIEW.BUDGET.DELETE.NOTIFY.success.header(),
        dismissible: false,
      });
      handleDeleted();
    },
    [handleDeleted],
  );

  const [deleteBudgets] = apiHooks.useDeleteAdministrationBudgets({
    onError,
    onSuccess,
  });

  const handleDelete = useCallback(async () => {
    await deleteBudgets({});
  }, [handleDeleted, deleteBudgets]);

  return (<>
    <Button onClick={() => setShowConfirm(true)}>{LL.ENTITY.Budget__DELETE()}</Button>
    {showConfirm && <DeleteConfirmationDialog
      visible
      title={LL.VIEW.BUDGET.DELETE.CONFIRM.title()}
      confirmationText={LL.VIEW.BUDGET.DELETE.CONFIRM.confirmationText()}
      deleteButtonText={LL.VIEW.BUDGET.DELETE.CONFIRM.deleteButtonText()}
      label={<LLSafeHtmlString string='VIEW.BUDGET.DELETE.CONFIRM.htmlLabel' />}
      onCancelClicked={() => setShowConfirm(false)}
      onDeleteClicked={handleDelete}
      loading={isProcessing}
    >
      {LL.VIEW.BUDGET.DELETE.CONFIRM.content()}
    </DeleteConfirmationDialog>}
  </>);
}


