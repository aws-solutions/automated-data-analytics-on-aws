/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { VError } from 'verror';
import { parseS3Path, s3PathJoin, s3PathJoinWithTrailingSlash, toS3Path } from '../s3-location-parser';

describe('s3-location-parser', () => {
  it('should parse an s3 location', () => {
    expect(parseS3Path('s3://bucket/key')).toEqual({
      bucket: 'bucket',
      key: 'key',
    });

    expect(parseS3Path('s3://bucket/key/nested')).toEqual({
      bucket: 'bucket',
      key: 'key/nested',
    });

    expect(parseS3Path('s3://bucket/key/nested/')).toEqual({
      bucket: 'bucket',
      key: 'key/nested/',
    });

    expect(() => {
      parseS3Path('incorrect/path');
    }).toThrow(VError);
  });

  it('should join s3 paths', () => {
    expect(s3PathJoin('s3://bucket/', 'key/nested')).toBe('s3://bucket/key/nested');
    expect(s3PathJoin('s3://bucket/', '/key/nested/')).toBe('s3://bucket/key/nested');
    expect(s3PathJoin('s3://bucket', 'key/nested')).toBe('s3://bucket/key/nested');
    expect(s3PathJoin('s3://bucket/', 'key/nested//')).toBe('s3://bucket/key/nested');
    expect(s3PathJoin('s3://bucket/', 'key/nested', 'another')).toBe('s3://bucket/key/nested/another');
    expect(s3PathJoin('s3://bucket/', 'key/nested', '/another')).toBe('s3://bucket/key/nested/another');
    expect(s3PathJoin('s3://bucket/', '/key/nested/', '/another/')).toBe('s3://bucket/key/nested/another');
  });

  it('should join s3 paths with a trailing slash', () => {
    expect(s3PathJoinWithTrailingSlash('s3://bucket/', 'key/nested')).toBe('s3://bucket/key/nested/');
    expect(s3PathJoinWithTrailingSlash('s3://bucket/', '/key/nested/')).toBe('s3://bucket/key/nested/');
    expect(s3PathJoinWithTrailingSlash('s3://bucket', 'key/nested')).toBe('s3://bucket/key/nested/');
    expect(s3PathJoinWithTrailingSlash('s3://bucket/', 'key/nested//')).toBe('s3://bucket/key/nested/');
    expect(s3PathJoinWithTrailingSlash('s3://bucket/', 'key/nested', 'another')).toBe(
      's3://bucket/key/nested/another/',
    );
    expect(s3PathJoinWithTrailingSlash('s3://bucket/', 'key/nested', '/another')).toBe(
      's3://bucket/key/nested/another/',
    );
    expect(s3PathJoinWithTrailingSlash('s3://bucket/', '/key/nested/', '/another/')).toBe(
      's3://bucket/key/nested/another/',
    );
  });

  it('should create construct s3 path from bucket and key', () => {
    expect(
      toS3Path({
        bucket: 'bucket',
        key: 'key',
      }),
    ).toBe('s3://bucket/key');
  });
});
