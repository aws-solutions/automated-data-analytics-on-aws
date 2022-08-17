/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Inline } from 'aws-northstar';
import { InlineProps } from 'aws-northstar/layouts/Inline';
import { isEmpty } from 'lodash';
import Badge, { BadgeProps } from 'aws-northstar/components/Badge';
import React from 'react';

export interface BadgeGroupProps {
  items?: (BadgeProps['content'] | BadgeProps)[];
  color: BadgeProps['color'];
  spacing?: InlineProps['spacing'];
  empty?: React.ReactNode;
}

export const BadgeGroup: React.FC<BadgeGroupProps> = ({ items, color = 'grey', spacing = 'xs', empty }) => {
  if (items == null || isEmpty(items)) {
    return <>{empty}</>;
  }

  return (
    <Inline spacing={spacing}>
      {items.map((item, index) => {
        if (typeof item === 'object') {
          return <Badge key={index} color={item.color || color} content={item.content} />;
        }

        return <Badge key={index} color={color} content={item} />;
      })}
    </Inline>
  );
};
