/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { S3Location } from '@ada/api';
import { VError } from 'verror';
import trim from 'lodash/trim';
import trimEnd from 'lodash/trimEnd';

/**
 * Parse an s3 path into its bucket and key
 * @param s3InputPath an s3 path eg s3://bucket/key
 */
export const parseS3Path = (s3InputPath: string): S3Location => {
  const s3Path = s3InputPath.toLocaleLowerCase();
  const s3StartPart = 's3://';

  if (!s3Path.startsWith(s3StartPart)) {
    throw new VError(
      { name: 'InvalidS3StartPartError' },
      `The provided location, ${s3InputPath}, does not start with ${s3StartPart}`,
    );
  }

  const parts = s3Path.substring(s3StartPart.length).split('/');

  return {
    bucket: parts.shift()!,
    key: parts.join('/'),
  };
};

/**
 * Join together s3 path parts
 * @param base the base to join s3 path parts onto
 * @param parts the parts to join
 */
export const s3PathJoin = (base: string, ...parts: string[]): string => {
  return `${trimEnd(base, '/')}/${parts.map((part) => trim(part, '/')).join('/')}`;
};

/**
 * Join together s3 path parts. A trailing slash will be added to the end of the result.
 * @param base the base to join s3 path parts onto
 * @param parts the parts to join
 */
export const s3PathJoinWithTrailingSlash = (base: string, ...parts: string[]): string => s3PathJoin(base, ...parts, '');

/**
 * Generate an s3 path given an s3 location
 */
export const toS3Path = ({ bucket, key }: S3Location): string => `s3://${s3PathJoin(bucket, key)}`;

/**
 * Generate an s3 path with a trailing slash given an s3 location
 */
export const toS3PathWithTrailingSlash = (location: S3Location): string => `${toS3Path(location)}/`;
