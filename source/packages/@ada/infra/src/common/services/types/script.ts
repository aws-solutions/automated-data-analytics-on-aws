/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { s3PathJoin, toS3Path } from '../utils/s3-location-parser';
import type { ScriptIdentifier } from '@ada/api-client';

/**
 * Get the key in the script bucket at which a script is stored
 * @param namespace the namespace in which the script resides
 * @param scriptId the id of the script
 */
export const getScriptS3Key = ({ scriptId, namespace }: ScriptIdentifier) =>
  `scripts/${namespace}/${scriptId}/transform_script.py`;

/**
 * Get the full s3 path for a script in the script bucket
 * @param scriptBucket the bucket name
 * @param scriptId the script id
 */
export const getScriptS3Path = (scriptBucket: string, scriptId: ScriptIdentifier) =>
  toS3Path({
    bucket: scriptBucket,
    key: getScriptS3Key(scriptId),
  });

/**
 * Location of the transform wrapper script
 */
export const getTransformWrapperScriptS3Folder = (): string => `transform_wrapper`;

export const getTransformWrapperScriptS3Key = (scriptBucket: string): string =>
  toS3Path({
    bucket: scriptBucket,
    key: s3PathJoin(getTransformWrapperScriptS3Folder(), 'transform_wrapper.py'),
  });
