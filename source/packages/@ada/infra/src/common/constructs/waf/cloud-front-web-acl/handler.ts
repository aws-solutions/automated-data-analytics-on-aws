/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AwsWAFV2Instance } from '@ada/aws-sdk';
import { Details, ResourceProperties, Response, WebACLHandler } from './types';
import type { CreateWebACLRequest, GetWebACLRequest, UpdateWebACLRequest, WebACL } from 'aws-sdk/clients/wafv2';

// Cloudfront web acls are all created in us-east-1
const waf = AwsWAFV2Instance({ region: 'us-east-1' });

function detailsFromResourceProperties(resourceProperties: ResourceProperties): Details {
  return JSON.parse(resourceProperties.Details);
}

interface NormalizedResponse {
  WebACL: Pick<WebACL, 'Id' | 'Name' | 'ARN'>;
  LockToken: string;
}

export async function getWebACL(id: string, name: string): Promise<NormalizedResponse> {
  const params: GetWebACLRequest = {
    Id: id,
    Name: name,
    Scope: 'CLOUDFRONT',
  };
  const response = await waf.getWebACL(params).promise();

  console.debug(`getWebACL:`, { params, response });

  const { WebACL: webACL, LockToken } = response;

  if (webACL == null || LockToken == null) {
    console.error('getWebACL response failed to result in entity', response);
    throw new Error(`Failed to getWebACL for ${id} ${name} - ${JSON.stringify(response)}`);
  }

  return {
    WebACL: webACL,
    LockToken,
  };
}

export async function createWebACL(details: Details): Promise<NormalizedResponse> {
  const params: CreateWebACLRequest = {
    ...details,
    Scope: 'CLOUDFRONT',
  };
  const response = await waf.createWebACL(params).promise();

  console.debug('createWebACL:', { params, response });

  const { Summary } = response;

  if (Summary == null || Summary.Id == null || Summary.ARN == null || Summary.LockToken == null) {
    console.error('createWebACL response did not contain `Summary.Id, Summar.ARN, Summary.LockToken`', response);
    throw new Error(`Failed to createWebACL resulted in invalid response: ${JSON.stringify(response)}`);
  }

  return {
    WebACL: {
      Id: Summary.Id,
      ARN: Summary.ARN,
      Name: details.Name,
    },
    LockToken: Summary.LockToken,
  };
}

export async function updateWebACL(id: string, details: Details): Promise<NormalizedResponse> {
  const { WebACL: webACL, LockToken } = await getWebACL(id, details.Name);

  const params: UpdateWebACLRequest = {
    ...details,
    Id: id,
    LockToken,
    Scope: 'CLOUDFRONT',
  };

  const response = await waf.updateWebACL(params).promise();

  console.debug('updateWebACL:', { params, response });

  const { NextLockToken } = response;

  return {
    WebACL: webACL,
    LockToken: NextLockToken as string,
  };
}

export async function deleteWebACL(id: string, name: string): Promise<NormalizedResponse> {
  const { WebACL: webACL, LockToken } = await getWebACL(id, name);

  await waf
    .deleteWebACL({
      Id: id,
      Name: name,
      Scope: 'CLOUDFRONT',
      LockToken,
    })
    .promise();

  return {
    WebACL: webACL,
    LockToken,
  };
}

export const handler: WebACLHandler = async (event) => {
  const requestType = event.RequestType;
  console.debug(`event:${requestType}`, event);

  let handlerResponse: Response;

  switch (requestType) {
    case 'Create': {
      const details = detailsFromResourceProperties(event.ResourceProperties);
      const { WebACL: webACL, LockToken } = await createWebACL(details);
      const { ARN, Id, Name } = webACL;

      handlerResponse = {
        PhysicalResourceId: Id,
        Status: 'SUCCESS',
        Data: {
          ARN,
          Id,
          Name,
          LockToken,
        },
      };
      break;
    }
    case 'Update': {
      let response: NormalizedResponse;
      const details = detailsFromResourceProperties(event.ResourceProperties);
      const oldDetails = detailsFromResourceProperties(event.OldResourceProperties!);
      // If the "Name" is changed, we must delete it first and consider as "Create" action
      if (oldDetails.Name !== details.Name) {
        console.warn('Name has changed during update - performing create instead of update');
        // If a different value is returned, CloudFormation will follow with a subsequent Delete for the previous ID (resource replacement).
        // For Delete, it will always return the current physical resource ID, and if the user returns a different one, an error will occur.
        // https://docs.aws.amazon.com/cdk/api/v1/docs/custom-resources-readme.html#handling-lifecycle-events-onevent
        response = await createWebACL(details);
      } else {
        response = await updateWebACL(event.PhysicalResourceId!, details);
      }

      const { WebACL: webACL, LockToken } = response;
      const { ARN, Id, Name } = webACL;

      handlerResponse = {
        PhysicalResourceId: Id,
        Status: 'SUCCESS',
        Data: {
          ARN,
          Id,
          Name,
          LockToken,
        },
      };
      break;
    }
    case 'Delete': {
      const details = detailsFromResourceProperties({
        ...event.ResourceProperties,
        ...event.OldResourceProperties!,
      });
      if (event.PhysicalResourceId == null || details.Name == null) {
        return {
          PhysicalResourceId: event.PhysicalResourceId,
          Status: 'SUCCESS',
        } as any;
      }
      const { WebACL: webACL, LockToken } = await deleteWebACL(event.PhysicalResourceId, details.Name);

      const { ARN, Id, Name } = webACL;

      handlerResponse = {
        PhysicalResourceId: Id,
        Status: 'SUCCESS',
        Data: {
          ARN,
          Id,
          Name,
          LockToken,
        },
      };
      break;
    }
  }

  console.debug('handlerResponse:', handlerResponse);

  return handlerResponse;
};
