/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { Microservice, MicroserviceProps } from '../../../common/services';
import QueryParseRenderApi from '../api';
import serviceConfig from '../service-config';

export interface QueryParseRenderServiceStackProps extends MicroserviceProps {
  readonly executeAthenaQueryLambdaRoleArn: string;
}

/**
 * Query Parse/Render Service Stack
 */
export class QueryParseRenderServiceStack extends Microservice {
  readonly api: QueryParseRenderApi;

  constructor(scope: Construct, id: string, props: QueryParseRenderServiceStackProps) {
    super(scope, id, { ...props, ...serviceConfig });

    this.api = new QueryParseRenderApi(this, 'Api', {
      ...serviceConfig,
      federatedApi: props.federatedApi,
      executeAthenaQueryLambdaRoleArn: props.executeAthenaQueryLambdaRoleArn,
    });
  }
}

export default QueryParseRenderServiceStack;
