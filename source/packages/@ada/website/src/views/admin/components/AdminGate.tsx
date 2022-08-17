/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { useHistory } from 'react-router-dom';
import { useIsAdmin, useIsRootAdmin } from '$core/provider/UserProvider';
import React, { useEffect } from 'react';

export const AdminGate: React.FC = ({ children }) => {
  const history = useHistory();
  const isAdmin = useIsAdmin();

  useEffect(() => {
    if (isAdmin !== true) {
      history.push('/');
    }
  }, [isAdmin]);

  if (isAdmin) {
    return <>{children}</>;
  }

  return null;
};

export const RootAdminGate: React.FC = ({ children }) => {
  const history = useHistory();
  const isRootAdmin = useIsRootAdmin();

  useEffect(() => {
    if (isRootAdmin !== true) {
      history.push('/');
    }
  }, [isRootAdmin]);

  if (isRootAdmin) {
    return <>{children}</>;
  }

  return null;
};
