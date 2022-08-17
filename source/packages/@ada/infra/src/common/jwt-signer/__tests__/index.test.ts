/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CallingUser } from '@ada/common';
import { signJwt, verifyJwt } from '../index';

const mockGetSecretValue = jest.fn();
const mockDecrypt = jest.fn();

jest.mock('@ada/aws-sdk', () => ({
  ...(jest.requireActual('@ada/aws-sdk') as any),
  AwsSecretsManagerInstance: jest.fn().mockImplementation(() => ({
    getSecretValue: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockGetSecretValue(...args))),
    }),
  })),
  AwsKMSInstance: jest.fn().mockImplementation(() => ({
    decrypt: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(mockDecrypt(...args))),
    }),
  })),
}));

const mockSign = jest.fn();
const mockVerify = jest.fn();
const mockDecode = jest.fn();

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockImplementation((...args) => mockSign(...args)),
  verify: jest.fn().mockImplementation((...args) => mockVerify(...args)),
  decode: jest.fn().mockImplementation((...args) => mockDecode(...args)),
}));

describe('jwt-signer', () => {
  const caller: CallingUser = { userId: 'jwt', username: 'jwt', groups: ['jwt'] };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSecretValue.mockReturnValue({ SecretString: 'secret', VersionId: 'secretVersion' });
    mockDecrypt.mockReturnValue({ Plaintext: 'plaintextSecret' });
    mockSign.mockReturnValue('signed');
    mockVerify.mockReturnValue({ verified: true });
    mockDecode.mockReturnValue({ version: 'decodeVersion' });
  });

  it('should sign a jwt', async () => {
    await signJwt(caller, new Date());

    expect(mockSign).toHaveBeenCalledWith(
      expect.objectContaining({
        ...caller,
        version: 'secretVersion',
      }),
      'plaintextSecret',
      expect.anything(),
    );
  });

  it('should verify a jwt', async () => {
    await verifyJwt('token');

    expect(mockVerify).toHaveBeenCalledWith('token', 'plaintextSecret');
  });
});
