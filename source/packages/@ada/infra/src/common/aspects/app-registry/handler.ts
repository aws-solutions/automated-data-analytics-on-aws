/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  CloudFormationCustomResourceEvent,
} from 'aws-lambda';
import { ServiceCatalogAppRegistryInstance } from '@ada/aws-sdk';

export async function handler(event: CloudFormationCustomResourceEvent) {
  const { applicationId } = event.ResourceProperties;

  switch (event.RequestType) {
    case 'Create':
    case 'Update':
      return getIsCompleteStatus(applicationId);
    case 'Delete':
      return {
        IsComplete: true,
      }
  }
}

const getIsCompleteStatus = async (applicationId: string) => {
  const state = await getApplicationResourceGroupState(applicationId);
  if (!state || state === 'CREATING' || state === 'UPDATING') {
    return {
      IsComplete: false,
    }
  }

  if (state === 'CREATE_COMPLETE' || state === 'UPDATE_COMPLETE') {
    return {
      IsComplete: true,
    }
  }

  throw new Error(`Application Resource Group is in ${state} state`);
}

const getApplicationResourceGroupState = async (applicationId: string) => {
  console.log('Querying Application Resource Group State');
  const appRegistry = ServiceCatalogAppRegistryInstance();

  const response = await appRegistry
    .getApplication({
      application: applicationId
    })
    .promise();

  const state = response.integrations?.resourceGroup?.state;
  
  console.log('Application Resource Group State: ', state);
  return state;
}