/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import { BaseApiRoutes, BaseApiRoutesProps } from './base';
import { COST_BASE_PATH } from './base-paths';
import { Construct } from 'constructs';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { EntityManagementTables } from '../../components/entity/constructs/entity-management-tables';
import { FederatedRestApi } from '../../../../common/constructs/api/federated-api';
import { GetCostOutput } from '../types';
import { InternalTokenKey } from '@ada/infra-common/constructs/kms/internal-token-key';
import { LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { StatusCodes } from 'http-status-codes';
import { TypescriptFunction } from '@ada/infra-common';

export const ROUTE_PATH = COST_BASE_PATH;

export interface CostApiRoutesProps extends Omit<BaseApiRoutesProps, 'routePath'> {
  readonly api: FederatedRestApi;
  readonly internalTokenKey: InternalTokenKey;
  readonly entityManagementTables: EntityManagementTables;
}

export class CostApiRoutes extends BaseApiRoutes {
  readonly getCostLambda: TypescriptFunction;

  constructor(scope: Construct, id: string, props: CostApiRoutesProps) {
    super(scope, id, { ...props, routePath: ROUTE_PATH });
    const { entityManagementTables, internalTokenKey, api } = props;

    // Utility method for lambda handlers
    const buildLambda = (handlerFile: string) =>
      new TypescriptFunction(this, `Lambda-${handlerFile}`, {
        package: 'cost-service',
        handlerFile: require.resolve(`../handlers/${handlerFile}`),
        environment: {},
        apiLayer: {
          endpoint: api.url,
        },
        entityManagementTables,
        internalTokenKey,
      });

    this.getCostLambda = buildLambda('get-cost');
    this.getCostLambda.addToRolePolicy(
      new PolicyStatement({
        actions: ['ce:GetCostAndUsage*'],
        resources: ['*'],
        effect: Effect.ALLOW,
      }),
    );

    this.route.addRoutes({
      // GET /cost
      GET: {
        operationName: 'listCosts',
        integration: new LambdaIntegration(this.getCostLambda),
        requestParameters: {
          startTimestamp: true,
          endTimestamp: true,
        },
        response: {
          name: 'GetCostOutput',
          description: 'Details about the cost',
          schema: GetCostOutput,
          errorStatusCodes: [StatusCodes.BAD_REQUEST, StatusCodes.FORBIDDEN],
        },
      },
    });
  }
}
