/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CreateIPSetRequest, GetIPSetRequest, GetIPSetResponse, UpdateIPSetRequest } from 'aws-sdk/clients/wafv2';
import { Details, IpSetHandler, ResourceProperties, Response } from './types';
import { WAFV2 } from 'aws-sdk';
import { omit, pick } from 'lodash';

// Cloudfront waf only supported in us-east-1
const waf = new WAFV2({ region: 'us-east-1' });

function detailsFromResourceProperties(resourceProperties: ResourceProperties): Details {
  return pick(resourceProperties, ['Name', 'Addresses', 'Description', 'IPAddressVersion'] as (keyof Details)[]);
}

type NormalizedResponse = Required<GetIPSetResponse>;

export async function getIPSet(id: string, name: string): Promise<NormalizedResponse> {
  const params: GetIPSetRequest = {
    Id: id,
    Name: name,
    Scope: 'CLOUDFRONT',
  };
  const response = await waf.getIPSet(params).promise();

  console.debug(`getIPSet:`, { params, response });

  const { IPSet, LockToken } = response;

  if (IPSet == null || LockToken == null) {
    console.error('getIPSet response failed to result in entity', response);
    throw new Error(`Failed to getIPSet for ${id} ${name} - ${JSON.stringify(response)}`);
  }

  return {
    IPSet,
    LockToken,
  };
}

export async function createIPSet(details: Details): Promise<NormalizedResponse> {
  const params: CreateIPSetRequest = {
    ...details,
    Scope: 'CLOUDFRONT',
  };
  const response = await waf.createIPSet(params).promise();

  console.debug('createIPSet:', { params, response });

  const { Summary } = response;

  if (Summary == null || Summary.Id == null || Summary.ARN == null || Summary.LockToken == null) {
    console.error('createIPSet response did not contain `Summary.Id, Summar.ARN, Summary.LockToken`', response);
    throw new Error(`Failed to createIPSet resulted in invalid response: ${JSON.stringify(response)}`);
  }

  return {
    IPSet: {
      Id: Summary.Id,
      ARN: Summary.ARN,
      Name: details.Name,
      Addresses: details.Addresses,
      IPAddressVersion: details.IPAddressVersion,
      Description: details.Description,
    },
    LockToken: Summary.LockToken,
  };
}

export async function updateIPSet(id: string, details: Details): Promise<NormalizedResponse> {
  const { IPSet, LockToken } = await getIPSet(id, details.Name);

  const params: UpdateIPSetRequest = {
    // updates do not allow changing IPAddressVersion
    ...(omit(details, ['IPAddressVersion'] as (keyof Details)[]) as Omit<Details, 'IPAddressVersion'>),
    Id: id,
    LockToken,
    Scope: 'CLOUDFRONT',
  };

  const response = await waf.updateIPSet(params).promise();

  console.debug('updateIPSet:', { params, response });

  const { NextLockToken } = response;

  return {
    IPSet,
    LockToken: NextLockToken as string,
  };
}

export async function deleteIPSet(id: string, name: string): Promise<NormalizedResponse> {
  const { IPSet, LockToken } = await getIPSet(id, name);

  await waf
    .deleteIPSet({
      Id: id,
      Name: name,
      Scope: 'CLOUDFRONT',
      LockToken,
    })
    .promise();

  return {
    IPSet,
    LockToken,
  };
}

export const handler: IpSetHandler = async (event) => {
  const requestType = event.RequestType;
  console.debug(`event:${requestType}`, event);

  let handlerResponse: Response;

  switch (requestType) {
    case 'Create': {
      const details = detailsFromResourceProperties(event.ResourceProperties);
      const { IPSet, LockToken } = await createIPSet(details);
      const { ARN, Id, Name } = IPSet;

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
      // If the "Name" is changed, we must delete it first and consider as "Create" action
      if (event.OldResourceProperties?.Name !== event.ResourceProperties.Name) {
        console.warn('Name has changed during update - performing create instead of update');
        // If a different value is returned, CloudFormation will follow with a subsequent Delete for the previous ID (resource replacement).
        // For Delete, it will always return the current physical resource ID, and if the user returns a different one, an error will occur.
        // https://docs.aws.amazon.com/cdk/api/v1/docs/custom-resources-readme.html#handling-lifecycle-events-onevent
        response = await createIPSet(details);
      } else {
        response = await updateIPSet(event.PhysicalResourceId!, details);
      }

      const { IPSet, LockToken } = response;
      const { ARN, Id, Name } = IPSet;

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
      const { IPSet, LockToken } = await deleteIPSet(event.PhysicalResourceId, details.Name);

      const { ARN, Id, Name } = IPSet;

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
