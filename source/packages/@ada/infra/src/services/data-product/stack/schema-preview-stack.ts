/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Bucket } from '../../../common/constructs/s3/bucket';
import { Construct } from 'constructs';
import { ExtendedNestedStack, getUniqueKmsKeyAlias } from '@ada/cdk-core';
import { Key } from 'aws-cdk-lib/aws-kms';
import { MicroserviceProps } from '@ada/microservice-common';
import { RemovalPolicy } from 'aws-cdk-lib';
import DataIngressVPC from '../core/network/vpc';
import SchemaPreview from '../components/schema-preview';
import SchemaPreviewApi from '../api/schema-preview-api';

export interface SchemaPreviewStackProps extends MicroserviceProps {
  readonly scriptBucket: Bucket;
  readonly dataBucket: Bucket;
  readonly accessLogsBucket: Bucket;
  readonly dataIngressVPC: DataIngressVPC;
}

/**
 * Nested stack for data product schema preview
 */
export class SchemaPreviewStack extends ExtendedNestedStack {
  constructor(scope: Construct, id: string, props: SchemaPreviewStackProps) {
    super(scope, id);

    const productPreviewKey = new Key(this, 'DataProductPreviewKey', {
      alias: getUniqueKmsKeyAlias(this, 'data-product-preview'),
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const schemaPreview = new SchemaPreview(this, 'SchemaPreview', {
      dataIngressVPC: props.dataIngressVPC,
      scriptBucket: props.scriptBucket,
      dataBucket: props.dataBucket,
      productPreviewKey,
      accessLogsBucket: props.accessLogsBucket,
    });

    new SchemaPreviewApi(this, 'Api', {
      ...props,
      schemaPreview,
      productPreviewKey,
      serviceNamespace: 'data-product-preview',
      serviceName: 'DataProductPreview',
    });
  }
}

export default SchemaPreviewStack;
