/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Auth } from 'aws-amplify';
import { ButtonDropdown } from 'aws-northstar';
import { clearUserSolutionPersistence } from '$config';
import { useHistory } from 'react-router-dom';
import { useI18nContext } from '@ada/strings/dist/i18n/i18n-react';
import { useUserProfile } from '$core/provider/UserProvider';
import React from 'react';

export interface LoggedUserMenuProps {}

export const LoggedUserMenu: React.FC<LoggedUserMenuProps> = () => {
  const { LL } = useI18nContext();
  const history = useHistory();

  const userProfile = useUserProfile();

  return (
    <ButtonDropdown
      darkTheme
      content={`${userProfile?.name}`}
      items={[
        {
          text: LL.CONST.MENU.PROFILE(),
          onClick: () => {
            history.push('/profile');
          },
        },
        {
          text: LL.CONST.MENU.SIGN_OUT(),
          onClick: async () => {
            // remove any user specific persisted data
            clearUserSolutionPersistence();

            // signs out users from all devices and invalidates all refresh tokens issued to the user
            // current access and id tokesn remain valid until they expire.
            await Auth.signOut({ global: true });

            window.location.reload();
          },
        },
      ]}
    />
  );
};
