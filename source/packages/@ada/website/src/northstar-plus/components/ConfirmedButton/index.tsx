/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Button } from 'aws-northstar';
import { ButtonProps } from 'aws-northstar/components/Button';
import { ConfirmDialog, ConfirmDialogProps } from '../ConfirmDialog';
import React, { useCallback, useState } from 'react';

export interface ConfirmedButtonProps extends Omit<ConfirmDialogProps, 'visible' | 'onCancel'> {
  onCancel?: () => void;
  cancelText?: string;
  confirmText?: string;
  buttonVariant?: ButtonProps['variant'];
  buttonText: React.ReactNode;
  disabled?: boolean;
}

export const ConfirmedButton: React.FC<ConfirmedButtonProps> = ({
  buttonText,
  buttonVariant,
  onCancel,
  onConfirm,
  disabled,
  ...props
}) => {
  const [visible, setVisible] = useState(false);

  const onButtonClick = useCallback(() => {
    setVisible(true);
  }, []);

  const onCancelHandler = useCallback(() => {
    setVisible(false);
    onCancel && onCancel();
  }, [onCancel]);

  const onConfirmHandler = useCallback(() => {
    setVisible(false);
    onConfirm && onConfirm();
  }, [onConfirm]);

  return (
    <>
      <Button variant={buttonVariant} onClick={onButtonClick} disabled={disabled}>
        {buttonText}
      </Button>
      <ConfirmDialog {...props} onCancel={onCancelHandler} onConfirm={onConfirmHandler} visible={visible} />
    </>
  );
};
