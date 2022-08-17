/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { useIsRootAdmin } from '../../../provider/UserProvider';
import { useNotificationContext } from '$northstar-plus';
import React, { useEffect } from 'react';

const PERSIST_KEY = 'root_admin.notification.ignore';

export const RootAdminNotification: React.FC = () => {
  const { addInfo } = useNotificationContext();

  const isRootAdmin = useIsRootAdmin();

  useEffect(() => {
    if (isRootAdmin) {
      const ignore = window.sessionStorage?.getItem(PERSIST_KEY) === 'true';

      if (!ignore) {
        addInfo({
          id: PERSIST_KEY,
          header: 'Root Admin',
          content: 'It is recommended to only use the "root" admin user for provisioning.',
          dismissible: true,
          onDismiss: () => {
            window.sessionStorage?.setItem(PERSIST_KEY, 'true');
          },
        });
      }
    }
  }, [isRootAdmin]);

  return null;
};
