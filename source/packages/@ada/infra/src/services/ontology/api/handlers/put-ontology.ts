/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultUser } from '../../../../common/services';
import { OntologyEntity } from '@ada/api';
import { OntologyNamespace } from '@ada/common';
import { OntologyStore } from '../../components/ddb/ontology';
import type { OntologyIdentifier, OntologyInput } from '@ada/api-client';

const ALLOWED_SYSTEM_MUTATIONS: (keyof OntologyInput)[] = ['defaultLens', 'aliases', 'updatedTimestamp'];

/**
 * Handler for creating/updating an ontology attribute
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'putOntology',
  async ({ requestParameters, body: ontologyInput }, { userId, groups }, _event, { log }) => {
    const { ontologyNamespace, ontologyId } = requestParameters;

    const ontologyIdentifier: OntologyIdentifier = { ontologyId, ontologyNamespace };

    if (
      ontologyNamespace === OntologyNamespace.PII_CLASSIFICATIONS &&
      (userId !== DefaultUser.SYSTEM || !groups.includes(DefaultUser.SYSTEM))
    ) {
      const existing = await OntologyStore.getInstance().getOntology(ontologyIdentifier);

      // Do not allow users to create new entities in reserved namespace
      if (existing == null) {
        return ApiResponse.badRequest({
          message: `Invalid ontology namespace: ${ontologyNamespace}. This is a reserved namespace. Please choose another namespace.`,
        });
      }

      // ensure that only allow properties are being updated on system ontology entities
      for (const key of Object.keys(ontologyInput) as (keyof OntologyInput)[]) {
        if (ALLOWED_SYSTEM_MUTATIONS.includes(key) !== true && ontologyInput[key] !== existing[key]) {
          log.warn(`Attempt to update not allowed field "${key}" of system owned ontology`, {
            ontologyIdentifier,
            ontologyInput,
          });
          return ApiResponse.badRequest({
            message: `System ontology only support modifying "${ALLOWED_SYSTEM_MUTATIONS.join(
              ',',
            )}" properties - "${key}" is not allowed.`,
          });
        }
      }
    }

    // NB: Ontology permissions are dictated by api access policies only.
    const ontology = {
      ...ontologyInput,
      ...ontologyIdentifier,
    };
    const clashingAliases = await OntologyStore.getInstance().getClashingAliases(ontologyIdentifier, ontology);
    log.info(`clashingAliases: ${clashingAliases}`);

    if (clashingAliases.length > 0) {
      const aliasList = clashingAliases.map((alias) => `${alias.alias} used by ${alias.ontologyId}`).join(', ');
      return ApiResponse.badRequest({
        message: `Aliases already in use! (${aliasList})`,
      });
    }

    const ret = await OntologyStore.getInstance().putOntology(ontologyIdentifier, userId, ontology);
    if (userId !== DefaultUser.SYSTEM) {
      return ApiResponse.success(ret);
    } else {
      return ApiResponse.success({ name: ret.name } as OntologyEntity);
    }
  },
);
