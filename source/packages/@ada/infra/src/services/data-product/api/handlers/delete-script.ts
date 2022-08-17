/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultGroupIds } from '@ada/common';
import { ScriptBucket } from '../../components/s3/script';
import { ScriptEntity, ScriptIdentifier } from '@ada/api';
import { ScriptStore } from '../../components/ddb/script';
import { entityIdentifier } from '@ada/api-client/types';

/**
 * Handler for deleting scripts
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'deleteDataProductScriptsNamespaceScript',
  async ({ requestParameters }, callingUser, _event, { relationshipClient, log }) => {
    const { scriptId, namespace } = requestParameters;

    const scriptIdentifier: ScriptIdentifier = { scriptId, namespace };
    log.debug(`scriptIdentifier`, { scriptIdentifier });

    // Check if there are any data products that reference this script
    const scriptEntity = entityIdentifier('DataProductScript', scriptIdentifier);
    log.debug(`scriptEntity`, { scriptEntity });
    const relatedDataProductIdentifiers = await relationshipClient.getRelatedEntitiesOfType(
      scriptEntity,
      'DataProductDomainDataProduct',
    );
    log.debug(`relatedDataProductIdentifiers`, { relatedDataProductIdentifiers });

    if (relatedDataProductIdentifiers.length > 0) {
      const dataProductNames = relatedDataProductIdentifiers
        .map(({ domainId, dataProductId }) => `${domainId}.${dataProductId}`)
        .join(', ');
      return ApiResponse.badRequest({
        message: `Script ${namespace}.${scriptId} cannot be deleted as it is referenced by data products: ${dataProductNames}`,
      });
    }

    const store = ScriptStore.getInstance();
    const script = await store.getScript(scriptIdentifier);

    if (!script) {
      return ApiResponse.notFound({
        message: `No script was found in namespace ${namespace} with id ${scriptId}`,
      });
    }

    if (script.createdBy !== callingUser.userId && !callingUser.groups.includes(DefaultGroupIds.ADMIN)) {
      return ApiResponse.forbidden({
        message: `You don't have permissions to delete the script in namespace ${namespace} with id ${scriptId}`,
      });
    }

    const deletedScript = await store.deleteScriptIfExists(scriptIdentifier);

    // Delete the script in s3, and delete all relationships for the script
    const [deletedScriptContent] = await Promise.all([
      ScriptBucket.getInstance().deleteScript(scriptIdentifier),
      relationshipClient.removeAllRelationships(scriptEntity),
    ]);

    log.info(`Deleted script with id ${scriptId}`);

    return ApiResponse.success({
      ...(deletedScript as ScriptEntity),
      source: deletedScriptContent.scriptContent,
    });
  },
);
