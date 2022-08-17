/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Alert, Flashbar, Theme, makeStyles } from 'aws-northstar';
import { FlashbarMessage } from 'aws-northstar/components/Flashbar';
import { Snackbar } from '@material-ui/core';
import { take } from 'lodash';
import { useNotificationContext } from '../../context';
import React, { useMemo, useRef } from 'react';

const DEFAULT_MAX = 3;

export interface NotificationsRendererProps {
  flashbarMax?: number;
  briefMax?: number;
}

export const NotificationsRenderer = ({ flashbarMax, briefMax }: NotificationsRendererProps = {}) => {
  return (
    <>
      <FlashbarNotificationsRenderer max={flashbarMax} />
      <BriefNotificationsRenderer max={briefMax} />
    </>
  );
};

export const FlashbarNotificationsRenderer: React.FC<{ max?: number }> = ({ max = DEFAULT_MAX }) => {
  const flashbarContainerRef = useRef<HTMLDivElement>(null);
  const classes = useStyles({ flashbarContainer: flashbarContainerRef.current });
  const { flashbarNotifications } = useNotificationContext();

  const messages = useMemo<FlashbarMessage[]>(() => {
    return take(flashbarNotifications, max).map((notification) => {
      // FlashbarMessage and Notification current have compatible interface - if that changes we need this
      return notification;
    });
  }, [flashbarNotifications, max]);

  return (
    <div className={classes.flashbarContainer}>
      {messages.length > 0 && <Flashbar items={messages} maxItemsDisplayed={max} />}
    </div>
  );
};

export const BriefNotificationsRenderer: React.FC<{ max?: number }> = ({ max = DEFAULT_MAX }) => {
  const { briefNotifications, dismissNotification } = useNotificationContext();

  const messages = useMemo(() => {
    return take(briefNotifications, max).map((notification) => {
      return notification;
    });
  }, [briefNotifications, max]);

  return (
    <>
      {messages.map(({ id, type, header, content, elementOptions, onDismiss }) => (
        <Snackbar key={id} open onClose={() => dismissNotification(id)} {...elementOptions}>
          <Alert
            type={type || 'info'}
            header={header}
            dismissible={!elementOptions?.autoHideDuration}
            onDismiss={onDismiss}
          >
            {content}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
};

interface StyleProps {
  flashbarContainer: HTMLDivElement | null;
}

const useStyles = makeStyles<Theme, StyleProps>((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    margin: 'auto auto',
  },
  flashbarContainer: {
    flex: 0,
    // keep flashbar persistent to top of content area
    position: 'sticky',
    top: 0,
    zIndex: theme.zIndex.modal - 1,
    transition: 'all 0.5s linear',
    '& > div': {
      animation: 'growDown 0.15s linear',
      animationFillMode: 'both',
    },
  },
}));
