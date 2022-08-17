/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Button, Text } from 'aws-northstar';
import { ModalPortal } from '$northstar-plus/components';
import { NORTHSTAR_COLORS } from 'aws-northstar/config/color';
import { makeStyles } from 'aws-northstar/themes';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useNotificationContext } from '../../context';
import Alert from 'aws-northstar/components/Alert';
import Badge from 'aws-northstar/components/Badge';
import Box from 'aws-northstar/layouts/Box';
import ButtonDropdown, { ButtonDropdownItem } from '../../../../components/ButtonDropdown';
import DeleteConfirmationDialog from 'aws-northstar/advanced/DeleteConfirmationDialog';
import NotificationsIcon from '@material-ui/icons/Notifications';
import React, { useCallback, useMemo, useState } from 'react';
import clsx from 'clsx';

export interface NotificationButtonProps {
  /** Indicates if "Dismiss All" button is added to list @default false */
  dismissAll?: boolean;
  /** Number of notification items required to show "Dismiss All" button @default 5 */
  dismissAllThreshold?: number;
}

/**
 * A button which succinctly indicates the number of notifications as a badge, with each notification shown when the button is clicked
 * */
export const NotificationButton: React.FC<NotificationButtonProps> = ({ dismissAll, dismissAllThreshold = 5 }) => {
  const { defaultNotifications: notifications } = useNotificationContext();

  const showDismissAll = dismissAll && notifications.length >= dismissAllThreshold;
  const [confirmDismissAll, setConfirmDismissAll] = useState(false);

  const styles = useStyles();
  const content = useMemo(
    () => (
      <Box>
        <NotificationsIcon className={clsx({ [styles.icon]: notifications.length === 0 })} />
        {notifications.length > 0 && <Badge color="blue" content={notifications.length} />}
      </Box>
    ),
    [notifications, styles.icon],
  );

  const items = useMemo(() => {
    const _items: ButtonDropdownItem[] = notifications.map(({ content: _content, onClick, id, ...props }) => ({
      key: id,
      text: (
        <Alert borderRadius={false} {...props}>
          {_content}
        </Alert>
      ),
      onClick,
    }));

    if (showDismissAll) {
      _items.unshift({
        text: <DismissAllItem onClick={() => setConfirmDismissAll(true)} />,
      });
    }

    return _items;
  }, [notifications, setConfirmDismissAll, showDismissAll]);

  return (
    <>
      <div data-testid="notifications-menu">
        <ButtonDropdown
          // change key to close menu while confirming delete all by forcing new instance
          key={String(confirmDismissAll)}
          menuItemClassName={styles.menuItem}
          disableArrowDropdown
          disableCloseOnSelection
          items={items}
          content={content}
          darkTheme
          innerMenuProps={{ keepMounted: false }}
        />
      </div>
      {confirmDismissAll && <DismissAllConfirmation visible setVisible={setConfirmDismissAll} />}
    </>
  );
};

export default NotificationButton;

const DismissAllConfirmation: React.FC<{
  visible: boolean;
  setVisible: React.Dispatch<React.SetStateAction<boolean>>;
}> = ({ visible, setVisible }) => {
  const { LL } = useI18nContext();
  const { dismissAllNotifications, defaultNotifications } = useNotificationContext();

  const count = defaultNotifications.length;

  const onDelete = useCallback(() => {
    dismissAllNotifications('default');
    setVisible(false);
  }, [dismissAllNotifications]);

  return (
    <ModalPortal>
      <DeleteConfirmationDialog
        visible={visible}
        variant="confirmation"
        title={LL.VIEW.notify.Notification.dismissAll.title()}
        deleteButtonText={LL.VIEW.notify.Notification.dismissAll.confirmButtonText()}
        onCancelClicked={() => setVisible(false)}
        onDeleteClicked={onDelete}
      >
        <Text>{LL.VIEW.notify.Notification.dismissAll.message(count)}</Text>
      </DeleteConfirmationDialog>
    </ModalPortal>
  );
};
const DismissAllItem: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { LL } = useI18nContext();
  const classes = useStyles();

  return (
    <Box className={classes.dismissAllContainer}>
      <Button variant="primary" onClick={onClick}>
        {LL.VIEW.notify.Notification.dismissAll.buttonText()}
      </Button>
    </Box>
  );
};

const useStyles = makeStyles({
  menuItem: {
    border: 'none',
    padding: 0,
    maxWidth: '500px',
    '&:hover': {
      border: 'none',
    },
  },
  icon: {
    verticalAlign: 'middle',
  },
  dismissAllContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    background: NORTHSTAR_COLORS.CHARCOAL_DARK,
    padding: 2,
    flex: 1,
  },
});
