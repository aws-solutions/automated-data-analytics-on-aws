/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsS3Instance, S3 } from '@ada/aws-sdk';
import { getScriptS3Key, getScriptS3Path } from '@ada/microservice-common';
import type { ScriptIdentifier } from '@ada/api-client';

// Bucket name passed as environment variables defined in the CDK infrastructure
const SCRIPT_BUCKET_NAME = process.env.SCRIPT_BUCKET_NAME ?? '';

export type S3PutDetails = {
  path: string;
  versionId: string;
};

export type S3GetDetails = {
  scriptContent: string;
};

/**
 * Class for interacting with S3 script files
 */
export class ScriptBucket {
  // Singleton instance of the script store
  private static instance: ScriptBucket | undefined;

  /**
   * Get an instance of the script store. Creates the instance with any default dependencies.
   */
  /* istanbul ignore next */
  public static getInstance = (): ScriptBucket => ScriptBucket.instance || new ScriptBucket(AwsS3Instance());

  private readonly s3: S3;

  /**
   * Create an instance of the script Bucket
   */
  private constructor(s3: S3) {
    this.s3 = s3;
  }

  /**
   * Create or update a script attribute
   * @param scriptId the id of the script attribute to use as key to create/update the file content
   * @param source the source of the script to be written/updated in Amazon S3
   */
  public putScript = async (scriptId: ScriptIdentifier, source: string): Promise<S3PutDetails> => {
    const result = await this.s3
      .putObject({
        Bucket: SCRIPT_BUCKET_NAME,
        Key: getScriptS3Key(scriptId),
        Body: source,
      })
      .promise();

    return {
      path: getScriptS3Path(SCRIPT_BUCKET_NAME, scriptId),
      versionId: result.VersionId!,
    };
  };

  /**
   * Get a scriptContents by scriptId
   * @param scriptId the id of the script to retrieve
   */
  public getScript = async (scriptId: ScriptIdentifier): Promise<S3GetDetails> => {
    const result = await this.s3
      .getObject({
        Bucket: SCRIPT_BUCKET_NAME,
        Key: getScriptS3Key(scriptId),
      })
      .promise();
    return {
      scriptContent: result.Body!.toString('utf-8'),
    };
  };

  /**
   * Delete a script from s3
   * @param scriptId the script to delete
   */
  public deleteScript = async (scriptId: ScriptIdentifier): Promise<S3GetDetails> => {
    const script = await this.getScript(scriptId);
    await this.s3
      .deleteObject({
        Bucket: SCRIPT_BUCKET_NAME,
        Key: getScriptS3Key(scriptId),
      })
      .promise();
    return script;
  };
}
