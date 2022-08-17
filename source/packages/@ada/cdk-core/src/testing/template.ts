/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { compact } from 'lodash';

const INCLUDES_DATE_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g;

const ALIAS_ARTIFACT_BUCKET = /(alias\/.*-key)(\d+)/gi;

const TMPDIR_REGEX = /\/(tmp|(private\/var))\/.*/gi;

const LOGGROUP_REGEX = /^(\/aws\/vendedlogs\/.*)\/.*$/gi;

const CDK_ASSET_PATH = /^(\/?cdk-)(?:.*)(\.zip)?$/gi;
const CDK_ASSET_ZIP = /.*\.zip$/gi;

const HASH_64_REGEX = /[a-z0-9]{64}/g;

/**
 * Cleans CFN template for snapshot testing. There are values that modify between synths in the testing
 * template that have no effect on CFN but break snapshot testing. This utility will normalize the template
 * for consistent snapshot tests.
 * @param template Template object to clean for snapshot
 * @returns cleaed template ready for snapshot test
 */
export function cleanTemplateForSnapshot(template: Record<string, unknown>): any {
  function _clone(value: unknown): any {
    if (value == null) return value;
    if (Array.isArray(value)) return value.map(_clone);
    if (typeof value === 'string') return _cloneString(value);
    if (typeof value === 'object') return _cloneObject(value as Record<string, unknown>);
    return value;
  }

  function _cloneString(value: string): string | null {
    // AssetParametersc89e34cca1026f58543ad72b351ef9257d06aedf3b0f12dc4422a496d90a2ebdS3VersionKey6D63C6C3
    // referencetoAdaStackAssetParameters13bd61ebd79ac5a767c4edd98543d39cf07adfdff66e67eeafd30b2255eb9626S3Bucket92C2AFF2Ref
    if (value.includes('AssetParameters')) {
      // delete asset hash basd values
      return null;
    }
    // ignore bootstrap stuff
    if (value.includes('BootstrapVersion')) {
      return null;
    }

    // ApiSchemaPreviewSchemaPreviewLambdatransformCurrentVersion15043C551850be2fb8ef33decf4a25a0966273e9
    if (value.includes('CurrentVersion')) {
      value = value.replace(/(.*(CurrentVersion)).*/, '$1###');
    }

    // "Description": "Schema Preview transform 2022-02-26T10:20:25.888Z"
    value = value.replace(INCLUDES_DATE_REGEX, '#date#');

    // "AliasName": "alias/ada/artifact-bucket-key013156511246"
    value = value.replace(ALIAS_ARTIFACT_BUCKET, '$1######');

    // deferred bundling dir
    value = value.replace(TMPDIR_REGEX, '##tmpdir##');

    // log group
    value = value.replace(LOGGROUP_REGEX, '$1/loggroup-######');

    // cdk asset zip path
    value = value.replace(CDK_ASSET_PATH, '$1#####$2');
    value = value.replace(CDK_ASSET_ZIP, 'cdkhash######.zip');

    // replace hashes
    value = value.replace(HASH_64_REGEX, '###hash64###');

    return value;
  }

  function _cloneObject(value: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      compact(
        Object.entries(value).map(([eKey, eValue]) => {
          const cleanKey = _cloneString(eKey);
          if (cleanKey == null) return null;
          return [cleanKey, _clone(eValue)];
        }),
      ),
    );
  }

  return _clone(template);
}
