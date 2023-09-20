/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { Portal } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import Close from '@material-ui/icons/Close';
import IconButton from '@material-ui/core/IconButton';
import React, { ReactNode, useEffect, useState } from 'react';
import clsx from 'clsx';

import { useModalRoot } from '$common/hooks/use-dom-node';
import Container from 'aws-northstar/layouts/Container';

export interface ModalProps {
  /** Whether the modal should be displayed */
  visible?: boolean;
  /** The title to display */
  title: string;
  /** The subtitle to display */
  subtitle?: string;
  /** The content of the modal */
  children: ReactNode;
  /** A footer to display */
  footer?: ReactNode;
  /** Callback for when the user dismisses the modal */
  onClose?: Function;
  /** the width of the modal */
  width?: string;
}

/** A modal is a pop-up dialog that can be used to prompt a user for confirmation. */
export const Modal = ({ visible = false, children, title, subtitle, footer, onClose, width }: ModalProps) => {
  const [isVisible, setVisible] = useState(false);
  const useStyles = makeStyles({
    cyclorama: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      opacity: 0,
      zIndex: -9999,
      background: 'rgba(255, 255, 255, 0.7)',
      display: 'flex',
      transition: 'opacity 0.2s linear',
    },
    cycloramaActive: {
      opacity: 1,
      zIndex: 1299,
    },
    modalPlaceholder: {
      width: width || '600px',
      margin: 'auto',
      position: 'relative',
    },
    closeButton: {
      padding: 0,
      '& > .MuiIconButton-label': {
        padding: 0,
      },
    },
  });
  const styles = useStyles({});

  useEffect(() => {
    setVisible(visible);
  }, [visible]);

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  return (
    // CHANGE: wrap modal in portal - prevents nested forms and is best practice with modals
    <ModalPortal>
      <section data-testid="modal" className={clsx(styles.cyclorama, { [styles.cycloramaActive]: isVisible })}>
        <div data-testid="modal-inner" className={styles.modalPlaceholder}>
          <Container title={title}
            subtitle={subtitle}
            actionGroup={<IconButton className={styles.closeButton}
              onClick={handleClose}
              aria-label="close">
              <Close />
            </IconButton>}
            footerContent={footer}>
            {children}
          </Container>
        </div>
      </section>
    </ModalPortal>
  );
};

export default Modal;

export const ModalPortal: React.FC = ({ children }) => {
  const modalRoot = useModalRoot();

  return <Portal container={modalRoot}>{children}</Portal>;
};
