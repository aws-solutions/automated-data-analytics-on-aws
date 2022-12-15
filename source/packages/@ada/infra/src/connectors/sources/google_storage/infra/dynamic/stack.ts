/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { GoogleConnectorSourceTask } from '@ada/connectors/common/google/base-stack';
import { ISourceDetails__GOOGLE_STORAGE } from '../..';
import { StaticInfra } from '@ada/infra-common/services';
import { toGSPath } from '@ada/infra-common/services/utils/gcp-storage-location-parser';
import type { DynamicInfraStackProps } from '@ada/dynamic-infra/stacks/dynamic-infrastructure-stack-base';

/**
 * Stack for a data product from Google Storage
 */
export class GoogleStorageSourceTask extends GoogleConnectorSourceTask {
  constructor(scope: Construct, id: string, props: DynamicInfraStackProps) {
    const details = props.dataProduct.sourceDetails as ISourceDetails__GOOGLE_STORAGE;

    super(scope, id, {
      ...props,
      connectorId: 'gs',
      connectorName: 'Google Cloud Storage',
      importStepName: 'ImportGoogleStorageData',
      importDataStateAccessor: (refs: StaticInfra.Refs.IRecord) =>
        refs.googleCloudStorageConnector.importDataStateMachine,
      stateMachineInput: {
        clientId: details.clientId,
        clientEmail: details.clientEmail,
        privateKeyId: details.privateKeyId,
        privateKeySecretName: details.privateKeySecretName,
        projectId: details.projectId,
        gcpStorageInputPath: toGSPath({
          bucket: details.bucket,
          key: details.key,
        }),
      },
    });
  }
}

export default GoogleStorageSourceTask;
