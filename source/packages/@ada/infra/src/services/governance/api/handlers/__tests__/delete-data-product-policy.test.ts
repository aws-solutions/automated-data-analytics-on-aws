/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'jest-extended';
import { APIGatewayProxyResult } from 'aws-lambda';
import { CallingUser, DataProductAccess, DefaultGroupIds } from '@ada/common';
import {
  DEFAULT_CALLER,
  apiGatewayEvent,
  getLocalDynamoDocumentClient,
  recreateAllTables,
} from '@ada/microservice-test-common';
import { DataProductPolicy } from '@ada/api';
import { DataProductPolicyStore } from '../../components/ddb/data-product-policy-store';
import { IRelationshipClient } from '../../../../api/components/entity/relationships/client';
import { buildApiRequest } from '@ada/api-gateway';
import { entityIdentifier } from '@ada/api-client/types';
import { handler } from '../delete-data-product-policy';
import { localDynamoLockClient } from '../../../../api/components/entity/locks/mock';
import { localDynamoRelationshipClient } from '../../../../api/components/entity/relationships/mock';

// Mock the store to point to our local dynamodb
const testDataProductPolicyStore = new (DataProductPolicyStore as any)(getLocalDynamoDocumentClient());
DataProductPolicyStore.getInstance = jest.fn(() => testDataProductPolicyStore);

describe('delete-data-product-policy', () => {
  const putPolicy = (policy: DataProductPolicy) => {
    const { domainId, dataProductId } = policy;
    return testDataProductPolicyStore.putDataProductPolicy(domainId, dataProductId, 'policy-creator', policy);
  };

  let relationshipClient: IRelationshipClient;

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    localDynamoLockClient();
    relationshipClient = localDynamoRelationshipClient();
  });

  // Helper method for calling the handler
  const deleteDataProductPolicyHandler = (
    domainId: string,
    dataProductId: string,
    callingUser: CallingUser = DEFAULT_CALLER,
  ): Promise<APIGatewayProxyResult> =>
    handler(
      buildApiRequest(callingUser, {
        pathParameters: { domainId, dataProductId },
      }) as any,
      null,
    );

  it.each(['policy-creator', DefaultGroupIds.ADMIN])(
    'should allow %s to delete a policy that exists',
    async (deletingUserId) => {
      const domainId = 'domain';
      const dataProductId = 'data-product';

      const dataProductEntity = entityIdentifier('DataProductDomainDataProduct', { domainId, dataProductId });
      const policyEntity = entityIdentifier('GovernancePolicyDomainDataProduct', { domainId, dataProductId });

      // Relate the data product to the policy
      await relationshipClient.addRelationships(DEFAULT_CALLER, dataProductEntity, [policyEntity]);

      const policy = {
        domainId,
        dataProductId,
        permissions: {
          admin: {
            access: DataProductAccess.FULL,
          },
          default: {
            access: DataProductAccess.READ_ONLY,
          },
        },
      };
      await putPolicy(policy);

      expect(await testDataProductPolicyStore.getDataProductPolicy(domainId, dataProductId)).toBeDefined();

      const response = await deleteDataProductPolicyHandler(domainId, dataProductId, {
        ...DEFAULT_CALLER,
        userId: deletingUserId,
        groups: [deletingUserId],
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual(expect.objectContaining(policy));

      expect(await testDataProductPolicyStore.getDataProductPolicy(domainId, dataProductId)).toBeUndefined();

      // There should not be any relationships for the policy
      expect(await relationshipClient.getRelatedEntities(dataProductEntity)).toHaveLength(0);
      expect(await relationshipClient.getRelatedEntities(policyEntity)).toHaveLength(0);
    },
  );

  it('should return 404 when attempting to delete a policy that does not exist', async () => {
    const response = await deleteDataProductPolicyHandler('domain', 'does-not-exist');
    expect(response.statusCode).toBe(404);
  });

  it('should return 403 when attempting to delete a policy that is not owned by the calling user', async () => {
    const domainId = 'domain';
    const dataProductId = 'data-product';
    const policy = {
      domainId,
      dataProductId,
      permissions: {
        admin: {
          access: DataProductAccess.FULL,
        },
        default: {
          access: DataProductAccess.READ_ONLY,
        },
      },
    };
    await putPolicy(policy);
    const response = await deleteDataProductPolicyHandler(domainId, dataProductId, {
      ...DEFAULT_CALLER,
      userId: 'unauthorized-user',
      groups: ['analyst'],
    });
    expect(response.statusCode).toBe(403);
  });
});
