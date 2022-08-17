/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AlertDialog, AlertDialogProps } from '../AlertDialog';
import { Button } from 'aws-northstar';
import { ButtonProps } from 'aws-northstar/components/Button';
import React, { useCallback, useState } from 'react';

export interface AlertButtonProps extends Omit<AlertDialogProps, 'visible' | 'onConfirm'> {
  confirmText?: string;
  buttonVariant?: ButtonProps['variant'];
  buttonText: React.ReactNode;
  disabled?: boolean;
  onConfirm?: () => void;
}

export const AlertButton: React.FC<AlertButtonProps> = ({
  buttonText,
  buttonVariant,
  onConfirm,
  disabled,
  ...props
}) => {
  const [visible, setVisible] = useState(false);

  const onButtonClick = useCallback(() => {
    setVisible(true);
  }, []);

  const onConfirmHandler = useCallback(() => {
    setVisible(false);
    onConfirm && onConfirm();
  }, [onConfirm]);

  return (
    <>
      <Button variant={buttonVariant} onClick={onButtonClick} disabled={disabled}>
        {buttonText}
      </Button>
      <AlertDialog {...props} onConfirm={onConfirmHandler} visible={visible} />
    </>
  );
};
