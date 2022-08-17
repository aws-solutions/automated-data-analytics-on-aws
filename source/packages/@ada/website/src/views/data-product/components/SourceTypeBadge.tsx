/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Box, Text } from 'aws-northstar';
import { SourceType } from '@ada/common';
import { SourceTypeEnum } from '@ada/api';
import { UXDataProductSourceTypes, UXDataProductSources } from '$source-type';
import React from 'react';

export interface SourceTypeBadgeProps {
  readonly sourceType: SourceType | SourceTypeEnum;
}

export const SourceTypeBadge: React.FC<SourceTypeBadgeProps> = ({ sourceType }) => {
  const { CONTENT } = UXDataProductSources[sourceType as UXDataProductSourceTypes];
  const { Icon, label } = CONTENT;

  return (
    <Box display="flex" alignItems="center" flexWrap="nowrap" whiteSpace="pre">
      <Icon width={24} height={24} alignmentBaseline="baseline" />
      <Text>{' ' + label}</Text>
    </Box>
  );
};
