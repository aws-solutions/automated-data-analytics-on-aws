/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { DynamicInfrastructureStackBaseProps } from './dynamic-infrastructure-stack-base';
import { GoogleConnectorSourceTask } from './google-connector-source-stack';
import { SourceDetailsGoogleBigQuery } from '@ada/common';
import { StaticInfrastructureRefs } from '../constructs/static-infrastructure-references';

export type GoogleBigQuerySourceTaskProps = DynamicInfrastructureStackBaseProps;

/**
 * Stack for a data product from Google BigQuery
 */
export class GoogleBigQuerySourceTask extends GoogleConnectorSourceTask {
  constructor(scope: Construct, id: string, props: GoogleBigQuerySourceTaskProps) {
    const details = props.dataProduct.sourceDetails as SourceDetailsGoogleBigQuery;

    super(scope, id, {
      ...props,
      connectorId: 'bigquery',
      connectorName: 'Google Big Query',
      importStepName: 'ImportBigQueryData',
      importDataStateAccessor: (refs: StaticInfrastructureRefs) => refs.googleBigQueryConnector.importDataStateMachine,
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
