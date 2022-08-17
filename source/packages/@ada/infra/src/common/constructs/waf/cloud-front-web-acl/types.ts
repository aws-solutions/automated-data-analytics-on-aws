/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CreateWebACLRequest, CreateWebACLResponse, UpdateWebACLRequest } from 'aws-sdk/clients/wafv2';
import type { CloudFormationCustomResourceEventCommon, CloudFormationCustomResourceResponseCommon } from 'aws-lambda';

export const CFN_RESOURCE_TYPE = 'Custom::CloudfrontWebACL';

export type RequestType = 'Create' | 'Update' | 'Delete';

export type Details = Pick<
  CreateWebACLRequest & UpdateWebACLRequest,
  | 'Name'
  | 'DefaultAction'
  | 'Description'
  | 'Rules'
  | 'VisibilityConfig'
  | 'Tags'
  | 'CustomResponseBodies'
  | 'CaptchaConfig'
>;

export interface ResourceProperties {
  ServiceToken: string;
  // Given the depths of configuration we need stringify the details
  Details: string;
}

export interface Event extends Omit<CloudFormationCustomResourceEventCommon, 'ResourceProperties'> {
  RequestType: RequestType;
  PhysicalResourceId?: string;
  ResourceProperties: ResourceProperties;
  OldResourceProperties?: ResourceProperties;
}

export type ResponseData = Pick<Required<CreateWebACLResponse>['Summary'], 'ARN' | 'Id' | 'Name' | 'LockToken'>;

export interface Response extends Pick<CloudFormationCustomResourceResponseCommon, 'PhysicalResourceId' | 'NoEcho'> {
  Status: 'SUCCESS' | 'FAILED';
  Reason?: string;
  Data: ResponseData;
}

export type WebACLHandler = (event: Event) => Promise<Response>;
