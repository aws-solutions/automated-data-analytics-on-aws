/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as pretokenGenerationTrigger from '../pretoken-generation-trigger';
import { CustomCognitoAttributes, DefaultGroupIds } from '@ada/common';
import { GroupStore } from '../../../components/ddb/groups';
import { PreTokenGenerationEvent, handler } from '../pretoken-generation-trigger';
import { getLocalDynamoDocumentClient, recreateAllTables } from '@ada/microservice-test-common';

// Mock the group store to point to our local dynamodb
const testGroupStore = new (GroupStore as any)(getLocalDynamoDocumentClient());
GroupStore.getInstance = jest.fn(() => testGroupStore);

const adminUpdateUserAttributesMock = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsCognitoIdentityServiceProviderInstance: jest.fn().mockImplementation(() => ({
    adminUpdateUserAttributes: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(adminUpdateUserAttributesMock(...args))),
    }),
  })),
}));

const mockRequest = (
  customAttributeValue?: string | null,
  adminEmail?: string,
  userName?: string,
  additionalProps?: any,
): Partial<PreTokenGenerationEvent> => ({
  triggerSource: 'any',
  userPoolId: 'any-user-pool',
  userName: userName || 'test-user',
  request: {
    userAttributes: {
      ...(customAttributeValue ? { [`custom:${CustomCognitoAttributes.CLAIMS}`]: customAttributeValue } : {}),
      ...(adminEmail ? { email: adminEmail } : {}),
      ...(additionalProps || {}),
    },
    groupConfiguration: {
      groupsToOverride: ['cognito-group'],
      iamRolesToOverride: ['default-iam'],
      preferredRole: ['default-role'],
    },
  },
  response: {
    claimsOverrideDetails: {},
  },
});

describe('pretoken-generation-trigger', () => {
  const now = '2021-01-01T00:00:00.000Z';

  beforeEach(async () => {
    // @ts-ignore
    await recreateAllTables(global.__JEST_DYNAMODB_TABLES);
    jest.useFakeTimers('modern').setSystemTime(new Date(now).getTime());
    process.env.AUTO_ASSOCIATE_ADMIN = 'true';
    adminUpdateUserAttributesMock.mockReturnValue({});
    // @ts-ignore this is for testing purpuse only and avoid to skip tests
    pretokenGenerationTrigger.ENABLE_CLAIMS_TO_GROUP_MAPPING = true;
  });

  afterEach(async () => {
    jest.useRealTimers();
    adminUpdateUserAttributesMock.mockClear();
  });

  afterAll(() => {
    process.env.AUTO_ASSOCIATE_ADMIN = 'true';
  });

  it.each([null, undefined, ''])('should not add a group if the custom claims are not provided (%s)', async (claim) => {
    const result = await handler(mockRequest(claim) as PreTokenGenerationEvent, null);

    expect(result.response.claimsOverrideDetails?.groupOverrideDetails?.groupsToOverride).toEqual([]);
    expect(adminUpdateUserAttributesMock).toHaveBeenCalledWith({
      UserPoolId: expect.any(String),
      Username: 'test-user',
      UserAttributes: [
        {
          Name: `custom:${CustomCognitoAttributes.GROUPS}`,
          Value: '',
        },
      ],
    });
  });

  it('should return the configured group if the custom claims are provided', async () => {
    await testGroupStore.putGroup(DefaultGroupIds.POWER_USER, 'test-user', {
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds: ['administer-permissions', 'read', 'administer-identity'],
    });
    await testGroupStore.putGroup(DefaultGroupIds.ADMIN, 'test-user', {
      description: 'Another group',
      claims: ['claim-4'],
      members: ['member-4'],
      apiAccessPolicyIds: ['query'],
    });

    const result = await handler(mockRequest('claim-1') as PreTokenGenerationEvent, null);

    expect(result.response.claimsOverrideDetails?.groupOverrideDetails?.groupsToOverride).toEqual([
      DefaultGroupIds.POWER_USER,
    ]);
    expect(adminUpdateUserAttributesMock).toHaveBeenCalledWith({
      UserPoolId: expect.any(String),
      Username: 'test-user',
      UserAttributes: [
        {
          Name: `custom:${CustomCognitoAttributes.GROUPS}`,
          Value: DefaultGroupIds.POWER_USER,
        },
      ],
    });
  });

  it('should return the configured group only once if claims belong to the same group', async () => {
    await testGroupStore.putGroup(DefaultGroupIds.POWER_USER, 'test-user', {
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds: ['administer-permissions', 'read', 'administer-identity'],
    });
    await testGroupStore.putGroup(DefaultGroupIds.ADMIN, 'test-user', {
      description: 'Another group',
      claims: ['claim-4'],
      members: ['member-4'],
      apiAccessPolicyIds: ['query'],
    });

    const result = await handler(mockRequest('claim-1,claim-2') as PreTokenGenerationEvent, null);

    expect(result.response.claimsOverrideDetails?.groupOverrideDetails?.groupsToOverride).toEqual([
      DefaultGroupIds.POWER_USER,
    ]);
    expect(adminUpdateUserAttributesMock).toHaveBeenCalledWith({
      UserPoolId: expect.any(String),
      Username: 'test-user',
      UserAttributes: [
        {
          Name: `custom:${CustomCognitoAttributes.GROUPS}`,
          Value: DefaultGroupIds.POWER_USER,
        },
      ],
    });
  });

  it.each(['claim-1,claim-4', '[claim-4,claim-3]', '[ claim-2, claim-4, claim-1 ]'])(
    'should return multiple groups if multiple custom claims are provided (%s)',
    async (claims) => {
      await testGroupStore.putGroup(DefaultGroupIds.POWER_USER, 'test-user', {
        description: 'The administrator group',
        claims: ['claim-1', 'claim-2', 'claim-3'],
        apiAccessPolicyIds: ['administer-permissions', 'read', 'administer-identity'],
      });
      await testGroupStore.putGroup(DefaultGroupIds.ADMIN, 'test-user', {
        description: 'Another group',
        claims: ['claim-4'],
        apiAccessPolicyIds: ['query'],
      });

      const result = await handler(mockRequest(claims) as PreTokenGenerationEvent, null);
      expect(result.response.claimsOverrideDetails?.groupOverrideDetails?.groupsToOverride).toEqual([
        DefaultGroupIds.ADMIN,
        DefaultGroupIds.POWER_USER,
      ]);
      expect(adminUpdateUserAttributesMock).toHaveBeenCalledWith({
        UserPoolId: expect.any(String),
        Username: 'test-user',
        UserAttributes: [
          {
            Name: `custom:${CustomCognitoAttributes.GROUPS}`,
            Value: `${DefaultGroupIds.ADMIN},${DefaultGroupIds.POWER_USER}`,
          },
        ],
      });
    },
  );

  it('should NOT return additional group if the custom claims are not mapped', async () => {
    await testGroupStore.putGroup(DefaultGroupIds.ADMIN, 'test-user', {
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds: ['administer-permissions', 'read', 'administer-identity'],
    });
    await testGroupStore.putGroup(DefaultGroupIds.POWER_USER, 'test-user', {
      description: 'Another group',
      claims: ['claim-4'],
      members: ['member-4'],
      apiAccessPolicyIds: ['query'],
    });

    const result = await handler(mockRequest('claim-100') as PreTokenGenerationEvent, null);

    expect(result.response.claimsOverrideDetails?.groupOverrideDetails?.groupsToOverride).toEqual([]);
    expect(adminUpdateUserAttributesMock).toHaveBeenCalledWith({
      UserPoolId: expect.any(String),
      Username: 'test-user',
      UserAttributes: [
        {
          Name: `custom:${CustomCognitoAttributes.GROUPS}`,
          Value: '',
        },
      ],
    });
  });

  it('should add the default group if flag autoAssignUsers is set to true', async () => {
    await testGroupStore.putGroup(DefaultGroupIds.DEFAULT, 'test-user', {
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds: ['administer-permissions', 'read', 'administer-identity'],
      autoAssignUsers: true,
    });

    const result = await handler(mockRequest('claim-100') as PreTokenGenerationEvent, null);

    expect(result.response.claimsOverrideDetails?.groupOverrideDetails?.groupsToOverride).toEqual([
      DefaultGroupIds.DEFAULT,
    ]);
    expect(adminUpdateUserAttributesMock).toHaveBeenCalledWith({
      UserPoolId: expect.any(String),
      Username: 'test-user',
      UserAttributes: [
        {
          Name: `custom:${CustomCognitoAttributes.GROUPS}`,
          Value: DefaultGroupIds.DEFAULT,
        },
      ],
    });
  });

  it('should add the group to the list if the user belongs to that group', async () => {
    await testGroupStore.putGroup(DefaultGroupIds.POWER_USER, 'test-user', {
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds: ['administer-permissions', 'read', 'administer-identity'],
    });

    const result = await handler(mockRequest('claim-100', undefined, 'member-1') as PreTokenGenerationEvent, null);

    expect(result.response.claimsOverrideDetails?.groupOverrideDetails?.groupsToOverride).toEqual([
      DefaultGroupIds.POWER_USER,
    ]);
    expect(adminUpdateUserAttributesMock).toHaveBeenCalledWith({
      UserPoolId: expect.any(String),
      Username: 'member-1',
      UserAttributes: [
        {
          Name: `custom:${CustomCognitoAttributes.GROUPS}`,
          Value: DefaultGroupIds.POWER_USER,
        },
      ],
    });
  });

  it('should add the group to the list if the user preferred username belong to the group members', async () => {
    await testGroupStore.putGroup(DefaultGroupIds.POWER_USER, 'test-user', {
      description: 'The administrator group',
      claims: ['claim-1', 'claim-2', 'claim-3'],
      members: ['member-1', 'member-2', 'member-3'],
      apiAccessPolicyIds: ['administer-permissions', 'read', 'administer-identity'],
    });

    const result = await handler(
      mockRequest('claim-100', undefined, 'idp-username', {
        preferred_username: 'member-1',
      }) as PreTokenGenerationEvent,
      null,
    );

    expect(result.response.claimsOverrideDetails?.groupOverrideDetails?.groupsToOverride).toEqual([
      DefaultGroupIds.POWER_USER,
    ]);
    expect(result.response.claimsOverrideDetails?.claimsToAddOrOverride).toEqual({
      preferred_username: 'member-1',
    });

    expect(adminUpdateUserAttributesMock).toHaveBeenCalledWith({
      UserPoolId: expect.any(String),
      Username: 'idp-username',
      UserAttributes: [
        {
          Name: `custom:${CustomCognitoAttributes.GROUPS}`,
          Value: DefaultGroupIds.POWER_USER,
        },
      ],
    });
  });

  it('should add the admin group if claims are empty but the auto association is enabled and the admin is the same as the input', async () => {
    const result = await handler(mockRequest('', 'test@domain.example.com') as PreTokenGenerationEvent, null);

    expect(result.response.claimsOverrideDetails?.groupOverrideDetails?.groupsToOverride).toEqual([
      DefaultGroupIds.ADMIN,
    ]);
    expect(process.env.AUTO_ASSOCIATE_ADMIN).toBe('true');
    expect(adminUpdateUserAttributesMock).toHaveBeenCalledWith({
      UserPoolId: expect.any(String),
      Username: 'test-user',
      UserAttributes: [
        {
          Name: `custom:${CustomCognitoAttributes.GROUPS}`,
          Value: DefaultGroupIds.ADMIN,
        },
      ],
    });
  });

  it('should NOT add the admin group if the auto association is enable but the admin email is different', async () => {
    const result = await handler(mockRequest('', 'different-admin@domain.example.com') as PreTokenGenerationEvent, null);

    expect(result.response.claimsOverrideDetails?.groupOverrideDetails?.groupsToOverride).toEqual([]);
    expect(process.env.AUTO_ASSOCIATE_ADMIN).toBe('true');
    expect(adminUpdateUserAttributesMock).toHaveBeenCalledWith({
      UserPoolId: expect.any(String),
      Username: 'test-user',
      UserAttributes: [
        {
          Name: `custom:${CustomCognitoAttributes.GROUPS}`,
          Value: '',
        },
      ],
    });
  });

  it('should NOT add the admin group if the auto association is disabled but the admin is the same', async () => {
    process.env.AUTO_ASSOCIATE_ADMIN = 'false';

    const result = await handler(mockRequest('', 'test@domain.example.com') as PreTokenGenerationEvent, null);

    expect(result.response.claimsOverrideDetails?.groupOverrideDetails?.groupsToOverride).toEqual([]);
    expect(process.env.AUTO_ASSOCIATE_ADMIN).toBe('false');
    expect(adminUpdateUserAttributesMock).toHaveBeenCalledWith({
      UserPoolId: expect.any(String),
      Username: 'test-user',
      UserAttributes: [
        {
          Name: `custom:${CustomCognitoAttributes.GROUPS}`,
          Value: '',
        },
      ],
    });
  });
});
