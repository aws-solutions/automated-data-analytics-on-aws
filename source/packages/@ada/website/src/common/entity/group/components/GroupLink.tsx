/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Group } from '@ada/api';
import { Link } from 'aws-northstar';
import { LinkProps } from 'aws-northstar/components/Link';
import { getGroupUrl } from '../utils';
import { identifierToName } from '$common/utils/identifier';
import { isEmpty, isString } from 'lodash';
import React, { useMemo } from 'react';

export const GroupLink: React.FC<{ group?: string | Group } & Omit<LinkProps, 'href' | 'children'>> = ({
  group,
  ...props
}) => {
  // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(() => {
    if (group == null || isEmpty(group)) return null;

    const groupId = isString(group) ? group : group.groupId;
    return (
      <Link key={groupId} {...props} href={getGroupUrl(groupId)}>
        {identifierToName(groupId)}
      </Link>
    );
  }, [JSON.stringify(group)]);
};
