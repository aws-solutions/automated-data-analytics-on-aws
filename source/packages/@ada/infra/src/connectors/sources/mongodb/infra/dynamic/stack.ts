/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AmazonNativeConnectorSourceTask } from '@ada/connectors/common/amazon/base-stack';
import { Construct } from 'constructs';
import { DataProductUpdatePolicy } from '@ada/common';
import { DynamicInfraStackProps } from '@ada/dynamic-infra/stacks/dynamic-infrastructure-stack-base';
import { ISourceDetails__MONGODB } from '../..';
import { StaticInfra } from '@ada/infra-common/services';

/**
 * Stack for dynamic infrastructure for a MongoDB Data Product
 */
export class MongoDBSourceStack extends AmazonNativeConnectorSourceTask {
  constructor(scope: Construct, id: string, props: DynamicInfraStackProps) {
    const details = props.dataProduct.sourceDetails as ISourceDetails__MONGODB;
    const updateTrigger = props.dataProduct.updateTrigger;

    if (details.bookmarkField) {
      props.dataProduct.updateTrigger.updatePolicy = DataProductUpdatePolicy.APPEND;
    } else {
      props.dataProduct.updateTrigger.updatePolicy = DataProductUpdatePolicy.REPLACE;
    }

    super(scope, id, {
      ...props,
      connectorId: 'mongodb',
      connectorName: 'MongoDB',
      importStepName: 'ImportMongoDBData',
      importDataStateAccessor: (refs: StaticInfra.Refs.IRecord) => refs.mongoDBConnector.importDataStateMachine,
      lastUpdatedDetailTableName: (refs: StaticInfra.Refs.IRecord) => refs.mongoDBConnector.lastUpdatedDetailTableName,
      stateMachineInput: {
        databaseEndpoint: details.databaseEndpoint,
        databasePort: details.databasePort,
        databaseName: details.databaseName,
        collectionName: details.collectionName,
        username: details.username,
        password: details.dbCredentialSecretName,
        dataProductId: props.dataProduct.dataProductId,
        domainId: props.dataProduct.domainId,
        triggerType: updateTrigger.triggerType,
        scheduleRate: updateTrigger.scheduleRate || '',
        tls: details.tls || '',
        tlsCA: details.tlsCA || '',
        tlsClientCert: details.tlsClientCertSecretName || '',
        extraParams: details.extraParams || '',
        bookmarkField: details.bookmarkField || '',
        bookmarkFieldType: details.bookmarkFieldType || '',
      },
    });
  }
}

export default MongoDBSourceStack;
