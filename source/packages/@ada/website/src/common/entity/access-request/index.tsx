/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as POLLING from '$config/polling';
import { AccessRequestAction } from '@ada/common';
import { AccessRequestEntity, AccessRequestIdentifier } from '@ada/api';
import { apiHooks, useApiInvalidation } from '$api';
import { useHistory } from 'react-router-dom';
import { useI18nContext } from '$strings';
import { useIsAdmin, useUserId } from '$core/provider/UserProvider';
import { useNotificationContext } from '$northstar-plus';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

const NOTIFICATION_UUID = Symbol('ACCESS_REQUEST_NOTIFICATION').toString();

type AcknowledgeMap = Record<string, [action: AccessRequestAction, pending: boolean]>;

export interface IAccessRequestContext {
  accessRequests?: AccessRequestEntity[];
  hasPendingAccessRequests: boolean;
  approveRequest: (accessRequest: AccessRequestEntity, reason: string) => Promise<void>;
  denyRequest: (accessRequest: AccessRequestEntity, reason: string) => Promise<void>;
  getAccessRequestAcknowledgement: (
    accessRequest: AccessRequestIdentifier,
  ) => [action: AccessRequestAction, pending: boolean] | null;
}

export const AccessRequestContext = React.createContext<IAccessRequestContext | undefined>(undefined); //NOSONAR (S2814:Duplicate) - false positive - type vs value

export const useAccessRequestContext = () => {
  const context = React.useContext(AccessRequestContext);
  if (context == null) throw new Error('Must wrap with AccessRequestContext.Provider');
  return context;
};

export const AccessRequestProvider: React.FC = ({ children }) => {
  const { LL } = useI18nContext();
  const history = useHistory();
  const { addError, addFlashbar, dismissNotification } = useNotificationContext();
  const { invalidateEntityLists } = useApiInvalidation();
  const userId = useUserId();
  const isAdmin = useIsAdmin();

  const [acknowledged, setAcknowledge] = useState<AcknowledgeMap>({});

  const getAcknowledgement = useCallback<IAccessRequestContext['getAccessRequestAcknowledgement']>(
    ({ groupId, userId }) => { //NOSONAR (S1117:ShadowVar) - ignore for readability
      return acknowledged[`${groupId}::${userId}`];
    },
    [acknowledged],
  );

  const select = useCallback(
    (items: AccessRequestEntity[]): AccessRequestEntity[] => {
      // filter acknowledge and prevent non-admins from approving themselves
      return items.filter((item) => {
        return !(getAcknowledgement(item) != null || (isAdmin === false && item.userId === userId));
      });
    },
    [userId, isAdmin, acknowledged],
  );

  const [accessRequests, queryInfo] = apiHooks.useAllIdentityRequests(
    {},
    {
      select,
      refetchInterval: POLLING.ACCESS_REQUESTS,
    },
  );

  const refetchRequests = useCallback(() => {
    queryInfo.refetch({ force: true });
    invalidateEntityLists('IdentityGroup');
  }, [queryInfo.refetch, invalidateEntityLists]); // eslint-disable-line react-hooks/exhaustive-deps

  const [sendDenyOrApprove] = apiHooks.usePutIdentityRequestActionAsync();

  const handleAction = useCallback(
    async ({ groupId, userId }: AccessRequestEntity, action: AccessRequestAction, reason: string) => { //NOSONAR (S1117:ShadowVar) - ignore for readability
      try {
        // update UI with processing
        setAcknowledge((current) => ({
          ...current,
          [`${groupId}::${userId}`]: [action, true],
        }));
        await sendDenyOrApprove({
          groupId,
          userId,
          action,
          putIdentityRequestActionRequest: {
            reason,
          },
        });
        setAcknowledge((current) => ({
          ...current,
          [`${groupId}::${userId}`]: [action, false],
        }));
        addFlashbar({
          header: LL.ENTITY.AccessRequest_.notify.header(groupId),
          content: reason,
          type: action === AccessRequestAction.DENY ? 'warning' : 'success',
          dismissible: 'auto',
        });
        refetchRequests();
      } catch (error: any) {
        addError({
          header: LL.VIEW.GROUP.AccessRequest.notify.failed({ userId, action }),
          content: error.message,
        });
      }
    },
    [],
  );
  const denyRequest = useCallback(
    async (accessRequest: AccessRequestEntity, reason: string) => {
      return handleAction(accessRequest, AccessRequestAction.DENY, reason);
    },
    [handleAction],
  );
  const approveRequest = useCallback(
    async (accessRequest: AccessRequestEntity, reason: string) => {
      return handleAction(accessRequest, AccessRequestAction.APPROVE, reason);
    },
    [handleAction],
  );

  const [notified, setNotified] = useState(false);
  const pendingCount = accessRequests?.length || 0;
  const hasPendingAccessRequests = pendingCount > 0;
  useEffect(() => {
    if (hasPendingAccessRequests === true && notified === false) {
      addFlashbar({
        id: NOTIFICATION_UUID,
        type: 'info',
        header: LL.VIEW.GROUP.AccessRequest.notify.persistent.header(pendingCount),
        content: LL.VIEW.GROUP.AccessRequest.notify.persistent.content(),
        dismissible: false,
        buttonText: LL.VIEW.GROUP.AccessRequest.notify.persistent.buttonText(),
        onButtonClick: () => history.push('/groups'),
      });
      setNotified(true);
    }

    if (hasPendingAccessRequests === false && notified === true) {
      dismissNotification(NOTIFICATION_UUID);
      setNotified(false);
    }
  }, [hasPendingAccessRequests, notified]);

  const context: IAccessRequestContext = useMemo(() => ({
    accessRequests,
    hasPendingAccessRequests,
    denyRequest,
    approveRequest,
    getAccessRequestAcknowledgement: getAcknowledgement,
  }), [accessRequests, hasPendingAccessRequests, 
    denyRequest, approveRequest, 
    getAcknowledgement]
  );
  
  return <AccessRequestContext.Provider value={context}>{children}</AccessRequestContext.Provider>;
};
