/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Inline, Text } from 'aws-northstar';
import { UserLink } from './UserLink';
import { UserProfile } from '../types';
import { isEmpty } from 'lodash';
import React, { Fragment, useMemo } from 'react';

export const UserLinkList: React.FC<{ users?: (string | UserProfile)[]; emptyValue?: React.ReactNode }> = ({
  users,
  emptyValue,
}) => {
  const userLinks = useMemo(() => {
    if (users == null || isEmpty(users)) return <>{emptyValue}</> || <Text variant="small">No users</Text>;

    return users.map((userId, index, arrary) => {
      const isLast = index === arrary.length - 1;
      return (
        <Fragment key={index}>
          <UserLink key={index} user={userId} />
          {isLast ? null : ','}
        </Fragment>
      );
    });
  }, [JSON.stringify(users), emptyValue]); // eslint-disable-line react-hooks/exhaustive-deps

  return <Inline spacing="xs">{userLinks}</Inline>;
};
