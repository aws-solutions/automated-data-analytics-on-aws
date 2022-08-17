/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { DynamicInfrastructureStackBaseProps } from './dynamic-infrastructure-stack-base';
import { GoogleConnectorSourceTask } from './google-connector-source-stack';
import { SourceDetailsGoogleAnalytics } from '@ada/common';
import { StaticInfrastructureRefs } from '../constructs/static-infrastructure-references';

export type GoogleAnalyticsSourceTaskProps = DynamicInfrastructureStackBaseProps;

/**
 * Stack for a data product from Google Analytics
 */
export class GoogleAnalyticsSourceTask extends GoogleConnectorSourceTask {
  constructor(scope: Construct, id: string, props: GoogleAnalyticsSourceTaskProps) {
    const details = props.dataProduct.sourceDetails as SourceDetailsGoogleAnalytics;
    const updateTrigger = props.dataProduct.updateTrigger;
    super(scope, id, {
      ...props,
      connectorId: 'analytics',
      connectorName: 'Google Analytics',
      importStepName: 'ImportAnalyticsData',
      importDataStateAccessor: (refs: StaticInfrastructureRefs) => refs.googleAnalyticsConnector.importDataStateMachine,
      stateMachineInput: {
        clientId: details.clientId,
        clientEmail: details.clientEmail,
        privateKeyId: details.privateKeyId,
        privateKeySecretName: details.privateKeySecretName,
        projectId: details.projectId,
        viewId: details.viewId,
        since: details.since || '',
        until: details.until || '',
        dimensions: details.dimensions,
        metrics: details.metrics,
        triggerType: updateTrigger.triggerType,
        scheduleRate: updateTrigger.scheduleRate || '',
      },
      additionalNotificationPayload: {
        viewId: details.viewId,
        since: details.since,
        until: details.until,
      },
    });
  }
}
