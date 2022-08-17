/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { Microservice, MicroserviceProps } from '../../../common/services';
import OntologyApi from '../api';
import serviceConfig from '../service-config';

export type OntologyServiceStackProps = MicroserviceProps;

/**
 * Ontology Service Stack
 */
export class OntologyServiceStack extends Microservice {
  readonly api: OntologyApi;

  constructor(scope: Construct, id: string, props: OntologyServiceStackProps) {
    super(scope, id, { ...props, ...serviceConfig });

    this.api = new OntologyApi(this, 'Api', {
      ...serviceConfig,
      ...props,
    });
  }
}

export default OntologyServiceStack;
