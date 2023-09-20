/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AdaUserPoolProps } from '../../../nested-stacks/cognito-auth-stack';
import { AwsCustomResource, AwsCustomResourcePolicy } from 'aws-cdk-lib/custom-resources';
import { BaseMicroservice, BaseMicroserviceProps } from '../../../common/services';
import { Bucket } from '../../../common/constructs/s3/bucket';
import { Construct } from 'constructs';
import { CountedTable } from '@ada/infra-common/constructs/dynamodb/counted-table';
import { CounterTable } from '../../../common/constructs/dynamodb/counter-table';
import { EntityManagementTables } from '../components/entity/constructs/entity-management-tables';
import { FederatedRestApi } from '../../../common/constructs/api/federated-api';
import { InternalTokenKey } from '../../../common/constructs/kms/internal-token-key';
import { NotificationBus } from '../components/notification/constructs/bus';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Stack } from 'aws-cdk-lib';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import FederatedApi from '../api';
import serviceConfig from '../service-config';

export interface ApiServiceStackProps extends BaseMicroserviceProps {
  userPool: UserPool;
  adaUserPoolProps: AdaUserPoolProps;
  autoAssociateAdmin: string;
  adminEmailAddress: string;
  notificationBus: NotificationBus;
  counterTable: CounterTable;
  internalTokenKey: InternalTokenKey;
  entityManagementTables: EntityManagementTables;
  accessLogsBucket: Bucket;
  userIdScope: string;
  cognitoDomain: string;
}

/**
 * FederatedApi Service Stack
 */
export class ApiServiceStack extends BaseMicroservice {
  readonly api: FederatedRestApi;

  public readonly machineTable: CountedTable;
  public readonly tokenTable: CountedTable;
  public readonly groupTable: CountedTable;
  public readonly apiAccessPolicyTable: CountedTable;
  public readonly accessRequestTable: CountedTable;

  constructor(scope: Construct, id: string, props: ApiServiceStackProps) {
    super(scope, id, { ...props, ...serviceConfig });

    const {
      userPool,
      autoAssociateAdmin,
      adminEmailAddress,
      notificationBus,
      counterTable,
      internalTokenKey,
      entityManagementTables,
      adaUserPoolProps,
      accessLogsBucket,
      userIdScope,
      cognitoDomain,
    } = props;

    const { federatedApi, machineTable, tokenTable, groupTable, apiAccessPolicyTable, accessRequestTable } =
      new FederatedApi(this, 'FederatedApi', {
        userPool,
        autoAssociateAdmin,
        adminEmailAddress,
        notificationBus,
        counterTable,
        internalTokenKey,
        entityManagementTables,
        adaUserPoolProps,
        accessLogsBucket,
        userIdScope,
        cognitoDomain,
      });

    this.api = federatedApi;
    this.machineTable = machineTable;
    this.tokenTable = tokenTable;
    this.groupTable = groupTable;
    this.apiAccessPolicyTable = apiAccessPolicyTable;
    this.accessRequestTable = accessRequestTable;

    // Do to ApiGateway rest service level requests limit, teardown fails - https://github.com/aws/aws-cdk/issues/9521
    // Using custom resource to delete the entire api, rather than per resource (resources, methods, integration, etc)
    new AwsCustomResource(this, 'ApiTeardown', { //NOSONAR (typescript:S1848) - cdk construct is used
      onDelete: {
        service: 'APIGateway',
        action: 'deleteRestApi',
        parameters: {
          restApiId: this.api.restApiId,
        },
      },
      policy: AwsCustomResourcePolicy.fromStatements([new PolicyStatement({
        resources: [Stack.of(this).formatArn({
          service: 'apigateway',
          resource: 'restapis',
          resourceName: this.api.restApiId,
        }),
          `arn:${Stack.of(this).partition}:apigateway:${Stack.of(this).region}::/restapis/${this.api.restApiId}`
        ],
        actions: ['apigateway:DELETE'],
      })]),
    });
  }
}

export default ApiServiceStack;
