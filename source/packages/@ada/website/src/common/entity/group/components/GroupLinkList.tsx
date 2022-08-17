/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { COGNITO_ADMINISTRATORS_GROUP } from '../constants';
import { Group } from '@ada/api';
import { GroupLink } from './GroupLink';
import { Inline, Text } from 'aws-northstar';
import { isEmpty } from 'lodash';
import React, { Fragment, useMemo } from 'react';

export const GroupLinkList: React.FC<{ groups?: (string | Group)[]; emptyValue?: React.ReactNode }> = ({
  groups,
  emptyValue,
}) => {
  const groupLinks = useMemo(() => {
    if (groups == null || isEmpty(groups)) return <>{emptyValue}</> || <Text variant="small">No groups</Text>;

    return groups
      .filter((g) => g !== COGNITO_ADMINISTRATORS_GROUP)
      .map((groupId, index, array) => {
        const isLast = index === array.length - 1;
        return (
          <Fragment key={index}>
            <GroupLink group={groupId} />
            {isLast ? null : ','}
          </Fragment>
        );
      });
  }, [JSON.stringify(groups), emptyValue]); // eslint-disable-line react-hooks/exhaustive-deps

  return <Inline spacing="xs">{groupLinks}</Inline>;
};
