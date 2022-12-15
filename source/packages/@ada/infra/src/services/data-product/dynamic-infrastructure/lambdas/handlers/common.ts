/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DATA_PRODUCT_APPEND_DATA_PARTITION_KEY, DataSetIds } from '@ada/common';
import { s3PathJoin, s3PathJoinWithTrailingSlash } from '@ada/microservice-common';

export function getNewIngestionLocation(
  inputTablePrefix: string,
  outputS3PathPrefix: string,
  ingestionTimestamp: string,
): { tablePrefix: string; outputS3Path: string } {
  // for new location, the outputS3PathPrefix should come in the format of
  // .  `<pathPrefix>/ada_default_dataset/`
  // this code remove the trailing `ada_default_dataset/` and add the timestamp in front of it
  // so it becomes
  //    `<pathPrefix>/<timestamp>/ada_default_dataset/`
  let pathPrefix = outputS3PathPrefix;
  const parts = outputS3PathPrefix.split('/');
  if (parts[parts.length - 2] === DataSetIds.DEFAULT) {
    pathPrefix = parts.slice(0, parts.length - 2).join('/');
  }

  return {
    tablePrefix: `${inputTablePrefix}${ingestionTimestamp}`,
    outputS3Path: s3PathJoinWithTrailingSlash(pathPrefix, ingestionTimestamp, DataSetIds.DEFAULT),
  };
}

export function getNewIngestionPartition(
  inputTablePrefix: string,
  outputS3PathPrefix: string,
  ingestionTimestamp: string,
): { tablePrefix: string; outputS3Path: string } {
  return {
    tablePrefix: inputTablePrefix,
    outputS3Path: s3PathJoin(
      outputS3PathPrefix,
      DataSetIds.DEFAULT,
      `${DATA_PRODUCT_APPEND_DATA_PARTITION_KEY}=${ingestionTimestamp}`,
    ),
  };
}
