/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { ExtendedNestedStack } from '@ada/cdk-core';
import { Key } from 'aws-cdk-lib/aws-kms';
import { MicroserviceConfig } from '@ada/infra-common/services';
import { NestedStackProps } from 'aws-cdk-lib';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import DataProductApi, { DataProductServiceApiProps } from '../api';
import DataProductCreationStateMachine from '../components/creation-state-machine';

export interface DataProductApiStackProps extends DataProductServiceApiProps, MicroserviceConfig, NestedStackProps {}

/**
 * API stack for Data Product Service
 */
export default class DataProductApiStack extends ExtendedNestedStack {
  readonly api: DataProductApi;

  readonly dataProductTable: Table;
  readonly dataBuckets: Bucket[];
  readonly dataProductCreationStateMachine: DataProductCreationStateMachine;

  readonly glueKmsKey: Key;

  constructor(scope: Construct, id: string, props: DataProductApiStackProps) {
    super(scope, id, props);

    this.api = new DataProductApi(this, 'Api', props);
  }
}
