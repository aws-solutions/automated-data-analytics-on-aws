/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Button, Inline, Modal } from 'aws-northstar';
import { ModalProps } from '../Modal';
import React from 'react';

export interface AlertDialogProps extends Omit<ModalProps, 'onClose' | 'footer'> {
  onConfirm: () => void;
  cancelText?: string;
  confirmText?: string;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  onConfirm,
  visible,
  title,
  subtitle,
  width,
  confirmText = 'OK',
  children,
}) => {
  return (
    <Modal
      title={title}
      subtitle={subtitle}
      visible={visible}
      width={width}
      onClose={onConfirm}
      footer={
        <Inline spacing="xs">
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
