/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { DynamicInfrastructureStackBaseProps } from './dynamic-infrastructure-stack-base';
import { GoogleConnectorSourceTask } from './google-connector-source-stack';
import { SourceDetailsGoogleStorage } from '@ada/common';
import { StaticInfrastructureRefs } from '../constructs/static-infrastructure-references';
import { toGSPath } from '@ada/infra-common/services/utils/gcp-storage-location-parser';

export type GoogleStorageSourceTaskProps = DynamicInfrastructureStackBaseProps;

/**
 * Stack for a data product from Google Storage
 */
export class GoogleStorageSourceTask extends GoogleConnectorSourceTask {
  constructor(scope: Construct, id: string, props: GoogleStorageSourceTaskProps) {
    const details = props.dataProduct.sourceDetails as SourceDetailsGoogleStorage;

    super(scope, id, {
      ...props,
      connectorId: 'gs',
      connectorName: 'Google Cloud Storage',
      importStepName: 'ImportGoogleStorageData',
      importDataStateAccessor: (refs: StaticInfrastructureRefs) =>
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
