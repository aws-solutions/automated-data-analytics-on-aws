/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/api-client-lambda';
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultGroupIds, DefaultUser, ReservedDomains } from '@ada/common';
import { EntityIdentifier, entityIdentifier } from '@ada/api-client/types';
import { ScriptBucket } from '../../components/s3/script';
import { ScriptEntity, ScriptIdentifier } from '@ada/api';
import { ScriptStore } from '../../components/ddb/script';
import { VError } from 'verror';

/**
 * Handler for creating/updating scripts
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'putDataProductScriptsNamespaceScript',
  async ({ requestParameters, body: script }, callingUser, _event, { relationshipClient, lockClient, log }) => {
    const { scriptId, namespace } = requestParameters;
    const { userId, groups } = callingUser;

    const scriptIdentifier: ScriptIdentifier = { scriptId, namespace };

    // System creates default scripts before the full api is deployed, so skip validation as the system user
    if (callingUser.userId !== DefaultUser.SYSTEM) {
      // Scan script for vulnerabilities
      const { report } = await ApiClient.create(callingUser).postDataProductScriptsValidate({
        scriptSourceValidationInput: {
          scriptSource: script.source,
        },
      });
      if (!report.passed) {
        log.warn('Script contains vulnerabilities:', {
          scriptSource: script.source,
          report,
        });
        throw new VError(
          { name: 'InvalidScriptError', info: { details: JSON.stringify(report) } },
          `Script ${scriptId} contains vulnerabilities`,
        );
      }
    }

    // Optimistically lock the domain when the namespace is a domain
    const isDomainBasedScript = !new Set(Object.values(ReservedDomains) as string[]).has(namespace);
    const domainEntityIdentifier: EntityIdentifier | undefined = isDomainBasedScript
      ? entityIdentifier('DataProductDomain', { domainId: namespace })
      : undefined;
    const domainLocks = domainEntityIdentifier ? await lockClient.acquire(domainEntityIdentifier) : [];

    // Check that the domain exists
    if (isDomainBasedScript) {
      await ApiClient.create(callingUser).getDataProductDomain({ domainId: namespace });
    }

    // Only the script creator or admin can edit an existing script
    const existingScript = await ScriptStore.getInstance().getScript(scriptIdentifier);
    if (existingScript && !(userId === existingScript.createdBy || groups.includes(DefaultGroupIds.ADMIN))) {
      return ApiResponse.forbidden({
        message: `User ${userId} is not permitted to modify script created by ${existingScript.createdBy}`,
      });
    }

    // Anyone can create a script in any namespace
    try {
      const s3Details = await ScriptBucket.getInstance().putScript(scriptIdentifier, script.source);

      // change the source to the bucket key so that can be stored in DDB
      // the original source contains the code of the script
      script.source = s3Details.path;
      script.versionId = s3Details.versionId;
    } catch (err: any) {
      log.debug('Error writing the file in S3', { err });

      return ApiResponse.badRequest(
        new VError(
          { name: 'PutScriptError', cause: err },
          `Error storing the script with namespace ${namespace} and id ${scriptId}`,
        ),
      );
    }

    const writtenScript = await ScriptStore.getInstance().putScript(scriptIdentifier, userId, {
      ...script,
      ...scriptIdentifier,
    });

    // Relate the script to the domain (if part of a domain)
    if (domainEntityIdentifier) {
      await relationshipClient.addRelationships(callingUser, domainEntityIdentifier, [
        entityIdentifier('DataProductScript', { namespace, scriptId }),
      ]);
    }

    await lockClient.release(...domainLocks);

    if (callingUser.userId !== DefaultUser.SYSTEM) {
      return ApiResponse.success(writtenScript);
    } else {
      // for system user, the call is made from CDK custom resource which has length limitation on response object.
      return ApiResponse.success({ name: writtenScript.name } as ScriptEntity);
    }
  },
);
