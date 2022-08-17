/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Button, Inline, Modal } from 'aws-northstar';
import { ModalProps } from '../Modal';
import React from 'react';

export interface ConfirmDialogProps extends Omit<ModalProps, 'onClose' | 'footer'> {
  onCancel: () => void;
  onConfirm: () => void;
  cancelText?: string;
  confirmText?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  onCancel,
  onConfirm,
  visible,
  title,
  subtitle,
  width,
  cancelText = 'Cancel',
  confirmText = 'Confirm',
  children,
}) => {
  return (
    <Modal
      title={title}
      subtitle={subtitle}
      visible={visible}
      width={width}
      onClose={onCancel}
      footer={
        <Inline spacing="xs">
          <Button onClick={onCancel}>{cancelText}</Button>
          <Button onClick={onConfirm} variant="primary">
            {confirmText}
          </Button>
        </Inline>
      }
    >
      {children}
    </Modal>
  );
};
