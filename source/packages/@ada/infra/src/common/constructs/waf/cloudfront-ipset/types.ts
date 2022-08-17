/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CreateIPSetRequest, CreateIPSetResponse, UpdateIPSetRequest } from 'aws-sdk/clients/wafv2';
import type { CloudFormationCustomResourceEventCommon, CloudFormationCustomResourceResponseCommon } from 'aws-lambda';

export const CFN_RESOURCE_TYPE = 'Custom::CloudfrontIPSet';

export type RequestType = 'Create' | 'Update' | 'Delete';

export type Details = Pick<
  CreateIPSetRequest & UpdateIPSetRequest,
  'Name' | 'Description' | 'Addresses' | 'IPAddressVersion'
>;

export interface ResourceProperties extends Details {
  ServiceToken: string;
}

export interface Event extends Omit<CloudFormationCustomResourceEventCommon, 'ResourceProperties'> {
  RequestType: RequestType;
  PhysicalResourceId?: string;
  ResourceProperties: ResourceProperties;
  OldResourceProperties?: ResourceProperties;
}

export type ResponseData = Pick<Required<CreateIPSetResponse>['Summary'], 'ARN' | 'Id' | 'Name' | 'LockToken'>;

export interface Response extends Pick<CloudFormationCustomResourceResponseCommon, 'PhysicalResourceId' | 'NoEcho'> {
  Status: 'SUCCESS' | 'FAILED';
  Reason?: string;
  Data: ResponseData;
}

export type IpSetHandler = (event: Event) => Promise<Response>;
