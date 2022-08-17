/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { ScriptBucket } from '../../components/s3/script';
import { ScriptStore } from '../../components/ddb/script';
import { VError } from 'verror';
import type { ScriptIdentifier } from '@ada/api-client';

/**
 * Handler for getting a script by scriptId
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'getDataProductScriptsNamespaceScript',
  async ({ requestParameters }, _callingUser, _event, { log }) => {
    const { scriptId, namespace } = requestParameters;

    const scriptIdentifier: ScriptIdentifier = { scriptId, namespace };
    log.debug(`scriptIdentifier`, { scriptIdentifier });

    const script = await ScriptStore.getInstance().getScript(scriptIdentifier);

    if (!script) {
      return ApiResponse.notFound(
        new VError(
          {
            name: 'EntityNotFound',
          },
          `Not Found: no script was found in namespace ${namespace} with scriptId ${scriptId}`,
        ),
      );
    }

    try {
      const { scriptContent } = await ScriptBucket.getInstance().getScript(scriptIdentifier);

      return ApiResponse.success({ ...script, source: scriptContent });
    } catch (e: any) {
      return ApiResponse.internalServerError(
        new VError(
          {
            name: 'InternalServerError',
            cause: VError.cause(e),
          },
          `Error getting contents from namespace ${namespace} and scriptId ${scriptId}`,
        ),
      );
    }
  },
);
