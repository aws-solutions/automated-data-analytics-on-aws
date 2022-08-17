/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Alert, Button, Text } from 'aws-northstar';
import { DefaultGroupIds } from '@ada/common';
import { PageLayout, useNotificationContext } from '$northstar-plus';
import { apiHooks } from '$api';
import { useCallback, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useI18nContext } from '$strings';
import { useIsAdminOrPowerUser, useIsDefaultUser, useUserId } from '$core/provider/UserProvider';

export const LandingPage: React.FC = () => {
  const { LL } = useI18nContext();
  const history = useHistory();
  const { addSuccess, addError } = useNotificationContext();
  const userId = useUserId();
  const isDefaultUser = useIsDefaultUser();
  const isAdminOrPowerUser = useIsAdminOrPowerUser();
  const hasAccess = isDefaultUser || isAdminOrPowerUser;
  const [putIdentityRequest] = apiHooks.usePutIdentityRequest({
    onError: (error) => {
      addError({
        header: LL.VIEW.PUBLIC.Landing.access.notify.error.header(),
        content: error.message,
      });
    },
    onSuccess: () => {
      addSuccess({
        header: LL.VIEW.PUBLIC.Landing.access.notify.success.header(),
        content: LL.VIEW.PUBLIC.Landing.access.notify.success.content(),
        dismissible: false,
      });
    },
  });

  // redirect user to home if they have access
  useEffect(() => {
    if (hasAccess) {
      history.push('/');
    }
  }, [hasAccess, history]);

  const requestAccess = useCallback(() => {
    putIdentityRequest({
      groupId: DefaultGroupIds.DEFAULT,
      userId,
      accessRequestInput: {
        message: LL.ENTITY.AccessRequest_.ACTIONS.requestorMessage({
          requestor: userId,
          group: DefaultGroupIds.DEFAULT,
        }),
      },
    });
  }, [userId, putIdentityRequest]);

  return (
    <PageLayout
      title={LL.VIEW.PUBLIC.Landing.title()}
      subtitle={LL.VIEW.PUBLIC.Landing.subtitle()}
      actionButtons={
        <Button variant="primary" onClick={requestAccess}>
          {LL.VIEW.PUBLIC.Landing.access.buttonText()}
        </Button>
      }
    >
      <Alert type="warning">{LL.VIEW.PUBLIC.Landing.access.message()}</Alert>

      <Text variant="p">{LL.VIEW.PUBLIC.Landing.access.disclaimer()}</Text>
    </PageLayout>
  );
};
