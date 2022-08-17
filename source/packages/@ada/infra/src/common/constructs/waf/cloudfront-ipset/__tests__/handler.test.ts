/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CreateIPSetResponse, DeleteIPSetResponse, GetIPSetResponse, IPSet, UpdateIPSetResponse } from 'aws-sdk/clients/wafv2';
import * as handler from '../handler';
import { Event, ResourceProperties, Response, CFN_RESOURCE_TYPE } from '../types';

const SERVICE_TOKEN = 'service-token'

const IP_SET: IPSet = {
	Id: 'mock-ipset-id',
	Addresses: ['address-1', 'address-2'],
	ARN: 'mock-arn',
	IPAddressVersion: 'IPV4',
	Name: 'TestName',
	Description: 'Test description',
}

async function invokeHandler (event: Partial<Event>): Promise<Response> {
	return handler.handler({
		LogicalResourceId: 'logicalId',
		RequestId: 'request-id',
		ResourceType: CFN_RESOURCE_TYPE,
		StackId: 'TestStack',
		ServiceToken: SERVICE_TOKEN,
		ResponseURL: 'https://example.com',
		...event,
	} as Event)
}

const sdkGetIPSet = jest.fn<GetIPSetResponse, any[]>();
const sdkCreateIPSet = jest.fn<CreateIPSetResponse, any[]>();
const sdkUpdateIPSet = jest.fn<UpdateIPSetResponse, any[]>();
const sdkDeleteIPSet = jest.fn<DeleteIPSetResponse, any[]>();

jest.mock('aws-sdk', () => ({
  ...(jest.requireActual('aws-sdk') as any),
  WAFV2: jest.fn().mockImplementation(() => ({
    getIPSet: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(sdkGetIPSet(...args))),
    }),
    createIPSet: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(sdkCreateIPSet(...args))),
    }),
    updateIPSet: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(sdkUpdateIPSet(...args))),
    }),
    deleteIPSet: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(sdkDeleteIPSet(...args))),
    }),
  })),
}));

describe('cloudfront-ipset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a IPSet', async () => {
    sdkCreateIPSet.mockReturnValue({
      Summary: {
				...IP_SET,
				LockToken: 'lock-1',
			},
    });
    const result = await invokeHandler({
			RequestType: 'Create',
			ResourceProperties: {
				ServiceToken: SERVICE_TOKEN,
				Name: IP_SET.Name,
				Addresses: IP_SET.Addresses,
				IPAddressVersion: IP_SET.IPAddressVersion,
			}
		});

    expect(result).toEqual(
      expect.objectContaining({
        PhysicalResourceId: IP_SET.Id,
        Status: 'SUCCESS',
        Data: {
          Id: IP_SET.Id,
          ARN: IP_SET.ARN,
          Name: IP_SET.Name,
					LockToken: 'lock-1',
        },
      }),
    );

		expect(sdkGetIPSet).toHaveBeenCalledTimes(0);
		expect(sdkCreateIPSet).toHaveBeenCalledTimes(1);
		expect(sdkUpdateIPSet).toHaveBeenCalledTimes(0);
		expect(sdkDeleteIPSet).toHaveBeenCalledTimes(0);
  });

  it('should update IPSet', async () => {
    sdkGetIPSet.mockReturnValue({
      IPSet: IP_SET,
			LockToken: 'lock-1'
    });
    sdkUpdateIPSet.mockReturnValue({
      NextLockToken: 'next-lock',
    });
		const ResourceProperties: ResourceProperties = {
			ServiceToken: SERVICE_TOKEN,
			Name: IP_SET.Name,
			Addresses: ['u-1', 'u-2'],
			IPAddressVersion: IP_SET.IPAddressVersion,
		}
    const result = await invokeHandler({
			RequestType: 'Update',
			PhysicalResourceId: IP_SET.Id,
			ResourceProperties,
			OldResourceProperties: {
				...ResourceProperties,
				Addresses: IP_SET.Addresses,
			}
		});

    expect(result).toEqual(
      expect.objectContaining({
        PhysicalResourceId: IP_SET.Id,
        Status: 'SUCCESS',
        Data: {
          Id: IP_SET.Id,
          ARN: IP_SET.ARN,
          Name: IP_SET.Name,
					LockToken: 'next-lock',
        },
      }),
    );

		expect(sdkGetIPSet).toHaveBeenCalledWith({
			Id: IP_SET.Id,
			Name: IP_SET.Name,
			Scope: 'CLOUDFRONT',
		});
		expect(sdkUpdateIPSet).toHaveBeenCalledWith(expect.objectContaining({
			Id: IP_SET.Id,
			Name: IP_SET.Name,
			Addresses: ResourceProperties.Addresses,
			Scope: 'CLOUDFRONT',
		}));
  });
  it('should replace IPSet if name drifts', async () => {
		const NEW_NAME = 'DriftedName';
		const NEW_ID = 'new-id';
    sdkCreateIPSet.mockReturnValue({
      Summary: {
				...IP_SET,
				Id: NEW_ID,
				Name: NEW_NAME,
				LockToken: 'lock-1',
			},
    });
		const ResourceProperties: ResourceProperties = {
			ServiceToken: SERVICE_TOKEN,
			Name: NEW_NAME,
			Addresses: IP_SET.Addresses,
			IPAddressVersion: IP_SET.IPAddressVersion,
		}
    const result = await invokeHandler({
			RequestType: 'Update',
			PhysicalResourceId: IP_SET.Id,
			ResourceProperties,
			OldResourceProperties: {
				...ResourceProperties,
				Name: IP_SET.Name,
			}
		});

    expect(result).toEqual(
      expect.objectContaining({
        PhysicalResourceId: NEW_ID,
        Status: 'SUCCESS',
        Data: {
          Id: NEW_ID,
          ARN: IP_SET.ARN,
          Name: NEW_NAME,
					LockToken: 'lock-1',
        },
      }),
    );

		expect(sdkCreateIPSet).toHaveBeenCalledWith(expect.objectContaining({
			Name: NEW_NAME,
		}));
		expect(sdkGetIPSet).not.toHaveBeenCalled();
		expect(sdkUpdateIPSet).not.toHaveBeenCalled();
  });

  it('should delete a IPSet', async () => {
		sdkGetIPSet.mockReturnValue({
      IPSet: IP_SET,
			LockToken: 'lock-1'
    });
    sdkDeleteIPSet.mockReturnValue({});

    const result = await invokeHandler({
			RequestType: 'Delete',
			PhysicalResourceId: IP_SET.Id,
			ResourceProperties: {
				ServiceToken: SERVICE_TOKEN,
				...IP_SET,
			}
		});

    expect(result).toEqual(
      expect.objectContaining({
        PhysicalResourceId: IP_SET.Id,
        Status: 'SUCCESS',
        Data: {
          Id: IP_SET.Id,
          ARN: IP_SET.ARN,
          Name: IP_SET.Name,
					LockToken: 'lock-1',
        },
      }),
    );

		expect(sdkDeleteIPSet).toHaveBeenCalledWith({
      Id: IP_SET.Id,
      Name: IP_SET.Name,
      Scope: 'CLOUDFRONT',
      LockToken: 'lock-1',
    })
  });
});
