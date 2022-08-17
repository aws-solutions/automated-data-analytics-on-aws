/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { KeyValuePair, Link, Stack } from 'aws-northstar';
import { LinkProps } from 'aws-northstar/components/Link';
import { Tooltip } from '$northstar-plus';
import { UserProfile } from '../types';
import { isEmpty } from 'lodash';
import { useFederatedUser } from '../hooks';
import { useI18nContext } from '$strings';
import React, { useMemo } from 'react';

export const UserLink: React.FC<
  { user?: string | UserProfile; noTooltip?: boolean } & Omit<LinkProps, 'href' | 'children'>
> = ({ user, noTooltip, ...props }) => {
  const { LL } = useI18nContext();
  const userProfile = useFederatedUser(user);
  const { id, name } = userProfile || (typeof user === 'string' ? { id: user, name: user } : { id: null, name: null });

  const link = useMemo(() => {
    if (id == null || isEmpty(id)) return null;

    // for non-federated users (such as thosed added via bulk) do not provide link to their profile page
    if (userProfile == null) return <>{id}</>;

    return (
      <Link key={id} {...props} href={`/users/${id}`}>
        {id}
      </Link>
    );
  }, [id, name, userProfile]);

  if (noTooltip !== true) {
    return (
      <Tooltip
        header={LL.ENTITY.User()}
        content={
          <Stack spacing="xs">
            <KeyValuePair label={LL.ENTITY['UserProfile@'].id.label()} value={id} />
            <KeyValuePair label={LL.ENTITY['UserProfile@'].name.label()} value={name} />
          </Stack>
        }
      >
        {link}
      </Tooltip>
    );
  }

  return link;
};
