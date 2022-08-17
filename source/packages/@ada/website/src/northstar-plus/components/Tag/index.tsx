/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { makeStyles } from '@material-ui/core/styles';
import Chip, { ChipProps } from '@material-ui/core/Chip';
import Inline from 'aws-northstar/layouts/Inline';
import React, { useMemo } from 'react';
import Stack, { StackProps } from 'aws-northstar/layouts/Stack';

const useStyles = makeStyles((theme) => ({
  root: {
    fontSize: '14px',
    backgroundColor: theme.palette.info.light,
    color: theme.palette.grey[900],
    border: `1px solid ${theme.palette.info.dark}`,
    borderRadius: 0,
    '& .MuiChip-label': {
      padding: '4px 10px',
    },
    '&:focus': {
      backgroundColor: theme.palette.info.light,
      color: theme.palette.grey[900],
    },
    '& .MuiChip-deleteIcon': {
      color: theme.palette.grey[600],
    },
    '& .MuiChip-deleteIcon:hover': {
      color: theme.palette.grey[900],
    },
  },
}));

interface KV {
  key: string;
  value?: string;
}

export interface TagProps {
  tag: KV;
  size?: ChipProps['size'];
  onClick?: (tag: KV) => void;
}

export const Tag: React.FC<TagProps> = ({ tag, size = 'small', onClick }) => {
  const styles = useStyles();

  const { key, value } = tag;
  const label = useMemo(() => {
    if (value) return `${key}:${value}`;
    return key;
  }, [key, value]);

  return (
    <Chip className={styles.root} label={label} color="primary" onClick={onClick && (() => onClick(tag))} size={size} />
  );
};

export default Tag;

export interface TagGroupProps {
  tags: KV[];
  spacing?: StackProps['spacing'];
  variant?: 'inline' | 'stack';
  size?: ChipProps['size'];
  onClick?: TagProps['onClick'];
}

export const TagGroup: React.FC<TagGroupProps> = ({
  tags,
  spacing = 'xs',
  variant = 'inline',
  size = 'small',
  onClick,
}) =>
  variant === 'stack' ? (
    <Stack spacing={spacing}>
      {tags.map((tag, index) => (
        <Tag key={index} tag={tag} size={size} onClick={onClick} />
      ))}
    </Stack>
  ) : (
    <Inline spacing={spacing}>
      {tags.map((tag, index) => (
        <Tag key={index} tag={tag} size={size} onClick={onClick} />
      ))}
    </Inline>
  );
