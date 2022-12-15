/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { GoogleConnectorSourceTask } from '@ada/connectors/common/google/base-stack';
import { ISourceDetails__GOOGLE_BIGQUERY } from '../..';
import { StaticInfra } from '@ada/infra-common/services';
import type { DynamicInfraStackProps } from '@ada/dynamic-infra/stacks/dynamic-infrastructure-stack-base';

/**
 * Stack for a data product from Google BigQuery
 */
export class GoogleBigQuerySourceTask extends GoogleConnectorSourceTask {
  constructor(scope: Construct, id: string, props: DynamicInfraStackProps) {
    const details = props.dataProduct.sourceDetails as ISourceDetails__GOOGLE_BIGQUERY;

    super(scope, id, {
      ...props,
      connectorId: 'bigquery',
      connectorName: 'Google Big Query',
      importStepName: 'ImportBigQueryData',
      importDataStateAccessor: (refs: StaticInfra.Refs.IRecord) => refs.googleBigQueryConnector.importDataStateMachine,
      stateMachineInput: {
        clientId: details.clientId,
        clientEmail: details.clientEmail,
        privateKeyId: details.privateKeyId,
        privateKeySecretName: details.privateKeySecretName,
        projectId: details.projectId,
        query: Buffer.from(details.query).toString('base64'),
      },
      additionalNotificationPayload: {
        query: details.query,
      },
    });
  }
}

export default GoogleBigQuerySourceTask;
