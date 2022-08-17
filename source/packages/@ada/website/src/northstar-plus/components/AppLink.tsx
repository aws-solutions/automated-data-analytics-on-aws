/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Link as RouterLink, LinkProps as RouterLinkProps } from 'react-router-dom';
import Link from 'aws-northstar/components/Link';
import React from 'react';

export type AppLinkProps = Omit<RouterLinkProps, 'component'>;

/**
 * AppLink merges ReactRouter `Link` and Northstar `Link` to provide styled
 * router based linking.
 * @deprecated
 */
export const AppLink: React.FC<AppLinkProps> = ({ children, ...props }) => {
  return (
    <RouterLink {...props} component={Link}>
      {children}
    </RouterLink>
  );
};
