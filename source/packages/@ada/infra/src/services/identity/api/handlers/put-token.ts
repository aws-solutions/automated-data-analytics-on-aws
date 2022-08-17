/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiLambdaHandler, ApiResponse } from '@ada/api-gateway';
import { DefaultGroupIds, addDays } from '@ada/common';
import { MachineStore } from '../../../api/components/ddb/machine-provider';
import { Token } from '@ada/microservice-common';
import { TokenStore } from '../../../api/components/ddb/token-provider';
import { VError } from 'verror';
import { createUserPoolClient } from '../../../api/components/cognito/cognito-identity-service-provider';
import { entityIdentifier } from '@ada/api-client/types';

const MAX_TOKENS_PER_MACHINE = 5;
const MAX_TOKEN_DURATION = 365; // in days

/**
 * Handler for creating/updating a token
 * @param event api gateway request
 * @param context lambda context
 */
export const handler = ApiLambdaHandler.for(
  'putIdentityMachineToken',
  async ({ requestParameters, body: token }, callingUser, _event, { relationshipClient, lockClient, log }) => {
    const { machineId, tokenId } = requestParameters;
    const { userId, username } = callingUser;
    const tokenStore = TokenStore.getInstance();
    const machineStore = MachineStore.getInstance();

    // Optimistically lock the machine
    const machineEntityIdentifier = entityIdentifier('IdentityMachine', { machineId });
    const [machineLock] = await lockClient.acquire(machineEntityIdentifier);
    const machine = await machineStore.getMachine(machineId);

    // Make sure the machine exists
    if (!machine) {
      return ApiResponse.badRequest({
        message: `The machine with machineId ${machineId} does not exists.`,
      });
    }

    // Only admin or the owner of the machine may create/update a token within the machine
    if (!callingUser.groups.includes(DefaultGroupIds.ADMIN) && machine.createdBy !== callingUser.userId) {
      return ApiResponse.forbidden({
        message: `You don't have access to create token for the machine ${machineId}.`,
      });
    }

    try {
      const tokenList = await tokenStore.listTokens(machineId, {});

      if (tokenList.tokens.length === MAX_TOKENS_PER_MACHINE) {
        return ApiResponse.badRequest({
          message: `Error storing token with ID ${tokenId} in machine ${machineId}: You reached the max number of token allowed per machine (${MAX_TOKENS_PER_MACHINE}), consider deleting unused tokens or create a new machine`,
        });
      }

      const currentToken = await tokenStore.getToken(machineId, tokenId);
      const maxTokenDuration = addDays(Date.now(), MAX_TOKEN_DURATION);
      const tokenExpiration = new Date(token.expiration);

      if (tokenExpiration > maxTokenDuration) {
        return ApiResponse.badRequest({
          message: `Error storing token with ID ${tokenId} in machine ${machineId}: The expiration value (${token.expiration}) is invalid, it can only be maximum ${MAX_TOKEN_DURATION} days in the future`,
        });
      }

      // this is sent as response
      let clientSecret;
      let clientId;

      // generate token only if the token is a new one, the jwt will be visible only once
      // the system only stores the client id in the db
      if (!currentToken) {
        const createdClient = await createUserPoolClient(`${tokenId}-${Date.now().toString(26)}`);

        clientId = createdClient.UserPoolClient!.ClientId!;
        clientSecret = createdClient.UserPoolClient!.ClientSecret!;
      } else {
        clientId = currentToken.clientId;
        token.expiration = currentToken.expiration;
      }

      const writtenToken = await tokenStore.putToken(machineId, tokenId, userId, {
        ...token,
        username,
        clientId,
        machineId,
        tokenId,
      });

      // Add the relationship for the new token
      await relationshipClient.addRelationships(callingUser, machineEntityIdentifier, [
        entityIdentifier('IdentityMachineToken', { machineId, tokenId }),
      ]);

      await machineLock.release();

      return ApiResponse.success({
        ...writtenToken,
        clientSecret,
        authToken: clientSecret ? Buffer.from(`${clientId}:${clientSecret}`).toString('base64') : undefined,
        authUrl: `https://${process.env.COGNITO_DOMAIN}/oauth2/token`,
      } as Token);
    } catch (e: any) {
      log.error('Error generating a new token: ');
      log.error(e);

      return ApiResponse.badRequest(
        new VError(
          {
            name: 'PutTokenError',
            cause: e,
          },
          `Error storing token with ID ${tokenId} in machine ${machineId}`,
        ),
      );
    }
  },
);
