/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import type { CreateWebACLResponse, DeleteWebACLResponse, GetWebACLResponse, WebACL, UpdateWebACLResponse } from 'aws-sdk/clients/wafv2';
import * as handler from '../handler';
import { Event, ResourceProperties, Response, CFN_RESOURCE_TYPE, Details } from '../types';

const SERVICE_TOKEN = 'service-token'

const WEB_ACL: WebACL = {
	Id: 'mock-WebACL-id',
	ARN: 'mock-arn',
	Name: 'TestName',
	Description: 'Test description',
	DefaultAction: { Allow: {} },
	VisibilityConfig: {
		CloudWatchMetricsEnabled: true,
		MetricName: 'TestMetric',
		SampledRequestsEnabled: true,
	}
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

const sdkGetWebACL = jest.fn<GetWebACLResponse, any[]>();
const sdkCreateWebACL = jest.fn<CreateWebACLResponse, any[]>();
const sdkUpdateWebACL = jest.fn<UpdateWebACLResponse, any[]>();
const sdkDeleteWebACL = jest.fn<DeleteWebACLResponse, any[]>();

jest.mock('@ada/aws-sdk', () => ({
  AwsWAFV2Instance: jest.fn().mockImplementation(() => ({
    getWebACL: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(sdkGetWebACL(...args))),
    }),
    createWebACL: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(sdkCreateWebACL(...args))),
    }),
    updateWebACL: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(sdkUpdateWebACL(...args))),
    }),
    deleteWebACL: (...args: any[]) => ({
      promise: jest.fn(() => Promise.resolve(sdkDeleteWebACL(...args))),
    }),
  })),
}));

describe('cloudfront-WebACL', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a WebACL', async () => {
    sdkCreateWebACL.mockReturnValue({
      Summary: {
				...WEB_ACL,
				LockToken: 'lock-1',
			},
    });
    const result = await invokeHandler({
			RequestType: 'Create',
			ResourceProperties: {
				ServiceToken: SERVICE_TOKEN,
				Details: JSON.stringify(WEB_ACL as Details),
			}
		});

    expect(result).toEqual(
      expect.objectContaining({
        PhysicalResourceId: WEB_ACL.Id,
        Status: 'SUCCESS',
        Data: {
          Id: WEB_ACL.Id,
          ARN: WEB_ACL.ARN,
          Name: WEB_ACL.Name,
					LockToken: 'lock-1',
        },
      }),
    );

		expect(sdkCreateWebACL).toHaveBeenCalledTimes(1);
  });

  it('should update WebACL', async () => {
    sdkGetWebACL.mockReturnValue({
      WebACL: WEB_ACL,
			LockToken: 'lock-1'
    });
    sdkUpdateWebACL.mockReturnValue({
      NextLockToken: 'next-lock',
    });
		const ResourceProperties: ResourceProperties = {
			ServiceToken: SERVICE_TOKEN,
			Details: JSON.stringify({
				...WEB_ACL,
				DefaultAction: { Block: {} },
			} as Details),
		}
    const result = await invokeHandler({
			RequestType: 'Update',
			PhysicalResourceId: WEB_ACL.Id,
			ResourceProperties,
			OldResourceProperties: {
				ServiceToken: SERVICE_TOKEN,
				Details: JSON.stringify(WEB_ACL as Details),
			}
		});

    expect(result).toEqual(
      expect.objectContaining({
        PhysicalResourceId: WEB_ACL.Id,
        Status: 'SUCCESS',
        Data: {
          Id: WEB_ACL.Id,
          ARN: WEB_ACL.ARN,
          Name: WEB_ACL.Name,
					LockToken: 'next-lock',
        },
      }),
    );

		expect(sdkGetWebACL).toHaveBeenCalledWith({
			Id: WEB_ACL.Id,
			Name: WEB_ACL.Name,
			Scope: 'CLOUDFRONT',
		});
		expect(sdkUpdateWebACL).toHaveBeenCalledWith(expect.objectContaining({
			Id: WEB_ACL.Id,
			Name: WEB_ACL.Name,
			DefaultAction: { Block: {} },
			Scope: 'CLOUDFRONT',
		}));
  });
  it('should replace WebACL if name drifts', async () => {
		const NEW_NAME = 'DriftedName';
		const NEW_ID = 'new-id';
    sdkCreateWebACL.mockReturnValue({
      Summary: {
				...WEB_ACL,
				Id: NEW_ID,
				Name: NEW_NAME,
				LockToken: 'lock-1',
			},
    });
		const ResourceProperties: ResourceProperties = {
			ServiceToken: SERVICE_TOKEN,
			Details: JSON.stringify({
				...WEB_ACL,
				Name: NEW_NAME,
			} as Details),
		}
    const result = await invokeHandler({
			RequestType: 'Update',
			PhysicalResourceId: WEB_ACL.Id,
			ResourceProperties,
			OldResourceProperties: {
				ServiceToken: SERVICE_TOKEN,
				Details: JSON.stringify(WEB_ACL as Details),
			}
		});

    expect(result).toEqual(
      expect.objectContaining({
        PhysicalResourceId: NEW_ID,
        Status: 'SUCCESS',
        Data: {
          Id: NEW_ID,
          ARN: WEB_ACL.ARN,
          Name: NEW_NAME,
					LockToken: 'lock-1',
        },
      }),
    );

		expect(sdkCreateWebACL).toHaveBeenCalledWith(expect.objectContaining({
			Name: NEW_NAME,
		}));
		expect(sdkGetWebACL).not.toHaveBeenCalled();
		expect(sdkUpdateWebACL).not.toHaveBeenCalled();
  });

  it('should delete a WebACL', async () => {
		sdkGetWebACL.mockReturnValue({
      WebACL: WEB_ACL,
			LockToken: 'lock-1'
    });
    sdkDeleteWebACL.mockReturnValue({});

    const result = await invokeHandler({
			RequestType: 'Delete',
			PhysicalResourceId: WEB_ACL.Id,
			ResourceProperties: {
				ServiceToken: SERVICE_TOKEN,
				Details: JSON.stringify(WEB_ACL as Details),
			}
		});

    expect(result).toEqual(
      expect.objectContaining({
        PhysicalResourceId: WEB_ACL.Id,
        Status: 'SUCCESS',
        Data: {
          Id: WEB_ACL.Id,
          ARN: WEB_ACL.ARN,
          Name: WEB_ACL.Name,
					LockToken: 'lock-1',
        },
      }),
    );

		expect(sdkDeleteWebACL).toHaveBeenCalledWith({
      Id: WEB_ACL.Id,
      Name: WEB_ACL.Name,
      Scope: 'CLOUDFRONT',
      LockToken: 'lock-1',
    })
  });
});
