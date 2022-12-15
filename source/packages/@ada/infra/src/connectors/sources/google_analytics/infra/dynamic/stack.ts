/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { GoogleConnectorSourceTask } from '@ada/connectors/common/google/base-stack';
import { ISourceDetails__GOOGLE_ANALYTICS } from '../..';
import { StaticInfra } from '@ada/infra-common/services';
import type { DynamicInfraStackProps } from '@ada/dynamic-infra/stacks/dynamic-infrastructure-stack-base';

/**
 * Stack for a data product from Google Analytics
 */
export class GoogleAnalyticsSourceTask extends GoogleConnectorSourceTask {
  constructor(scope: Construct, id: string, props: DynamicInfraStackProps) {
    const details = props.dataProduct.sourceDetails as ISourceDetails__GOOGLE_ANALYTICS;
    const updateTrigger = props.dataProduct.updateTrigger;
    super(scope, id, {
      ...props,
      connectorId: 'analytics',
      connectorName: 'Google Analytics',
      importStepName: 'ImportAnalyticsData',
      importDataStateAccessor: (refs: StaticInfra.Refs.IRecord) => refs.googleAnalyticsConnector.importDataStateMachine,
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

export default GoogleAnalyticsSourceTask;
