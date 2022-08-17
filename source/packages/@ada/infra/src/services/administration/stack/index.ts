/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { Microservice, MicroserviceProps } from '../../../common/services';
import { Stack } from 'aws-cdk-lib';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import AdministrationApi from '../api';
import DataProductCreationStateMachine from '../../data-product/components/creation-state-machine';
import serviceConfig from '../service-config';

export interface AdministrationServiceStackProps extends MicroserviceProps {
  dataProductCreationStateMachine: DataProductCreationStateMachine;
  dataProductTable: Table;
  dataBuckets: Bucket[];
  coreStack: Stack;
}

/**
 * Administration Service Stack
 */
export class AdministrationServiceStack extends Microservice {
  readonly api: AdministrationApi;

  constructor(scope: Construct, id: string, props: AdministrationServiceStackProps) {
    super(scope, id, { ...props, ...serviceConfig });

    this.api = new AdministrationApi(this, 'Api', {
      ...serviceConfig,
      ...props,
    });
  }
}

export default AdministrationServiceStack;
