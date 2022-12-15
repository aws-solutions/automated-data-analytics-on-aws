/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */

import * as cdk from 'aws-cdk-lib';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';

import { Construct } from 'constructs';
import AdministrationApi from '@ada/services/administration/api';
import DataProductApi from '@ada/services/data-product/api';
import GovernanceApi from '@ada/services/governance/api';
import OntologyApi from '@ada/services/ontology/api';
import QueryApi from '@ada/services/query/api';
import QueryParseRenderApi from '@ada/services/query-parse-render/api';

export interface DashboardProps {
  dataProductTable: ddb.ITable;
  domainTable: ddb.ITable;
  dataProductApi: DataProductApi;
  queryApi: QueryApi;
  queryParserApi: QueryParseRenderApi;
  administrationApi: AdministrationApi;
  governanceApi: GovernanceApi;
  ontologyApi: OntologyApi;
}

export class Dashboard extends Construct {
  constructor(scope: Construct, id: string, private readonly props: DashboardProps) {
    super(scope, id);

    new cw.Dashboard(this, 'cw-dashboard', {
      widgets: [
        // ddbs
        [
          ...this.createDynamoDbWidgets({
            tableName: props.dataProductTable.tableName,
            friendlyTableName: 'Data Product Table',
          }),
          ...this.createDynamoDbWidgets({
            tableName: props.domainTable.tableName,
            friendlyTableName: 'Domain Table',
          }),
        ],

        // admin api
        [
          ...this.createLambdaWidgets(this.props.administrationApi.startTearDownDestroyDataLambda.functionName),
          ...this.createLambdaWidgets(this.props.administrationApi.startTearDownRetainDataLambda.functionName),
          ...this.createLambdaWidgets(this.props.administrationApi.tearDownLambda.functionName),
        ],

        // query api
        [
          ...this.createLambdaWidgets(this.props.queryApi.functions.startQueryExecutionSyncLambda.functionName),
          ...this.createLambdaWidgets(this.props.queryApi.functions.startQueryExecutionSyncLambda.functionName),
          ...this.createLambdaWidgets(this.props.queryApi.functions.getAthenaQueryResultLambda.functionName),
          ...this.createLambdaWidgets(this.props.queryApi.functions.getAthenaQuerySyncResultLambda.functionName),
          ...this.createLambdaWidgets(this.props.queryApi.functions.getAthenaQueryResultAsAthenaLambda.functionName),
        ],

        // query parser api
        [
          ...this.createLambdaWidgets(this.props.queryParserApi.athenaLensLambda.functionName),
          ...this.createLambdaWidgets(this.props.queryParserApi.discoverLambda.functionName),
          ...this.createLambdaWidgets(this.props.queryParserApi.rewriteLambda.functionName),
        ],

        // governance api
        [
          ...this.createLambdaWidgets(this.props.governanceApi.functions.getDefaultLensPolicyLambda.functionName),
          ...this.createLambdaWidgets(this.props.governanceApi.functions.getAttributePolicyLambda.functionName),
          ...this.createLambdaWidgets(this.props.governanceApi.functions.getAttributeValuePolicyLambda.functionName),
          ...this.createLambdaWidgets(this.props.governanceApi.functions.getDataProductPolicyLambda.functionName),
          ...this.createLambdaWidgets(
            this.props.governanceApi.functions.getDataProductPolicyPermissionsLambda.functionName,
          ),
        ],

        // ontology api
        [
          ...this.createLambdaWidgets(this.props.ontologyApi.getOntologyLambda.functionName),
          ...this.createLambdaWidgets(this.props.ontologyApi.listOntologiesLambda.functionName),
        ],
      ],
    });
  }

  private createLambdaWidgets(functionName: string): cw.IWidget[] {
    const successRateMetrics = this.createSuccessRateMetrics(functionName);
    const maximumDurationMetrics = this.lambdaMetric(
      functionName,
      'Maximum',
      'Duration',
      cw.Statistic.MAXIMUM,
      cw.Unit.MILLISECONDS,
    );
    const averageDurationMetrics = this.lambdaMetric(
      functionName,
      'Average',
      'Duration',
      cw.Statistic.AVERAGE,
      cw.Unit.MILLISECONDS,
    );
    const minDurationMetrics = this.lambdaMetric(
      functionName,
      'Minimum',
      'Duration',
      cw.Statistic.MINIMUM,
      cw.Unit.MILLISECONDS,
    );

    return [
      this.lambdaWidget(`${functionName} - Duration`, [
        minDurationMetrics,
        maximumDurationMetrics,
        averageDurationMetrics,
      ]),
      this.createGraphWidget({
        title: `${functionName} -  Success Rate`,
        left: [successRateMetrics],
        leftYAxis: { max: 100, min: 0, label: 'Percent', showUnits: false },
      }),
    ];
  }

  private createSuccessRateMetrics(functionName: string) {
    const invocations: cw.IMetric = this.lambdaMetric(
      functionName,
      'Invocations',
      'Invocations',
      cw.Statistic.SUM,
      cw.Unit.COUNT,
    );

    const errorCount: cw.IMetric = this.lambdaMetric(functionName, 'Error', 'Errors', cw.Statistic.SUM, cw.Unit.COUNT);

    return new cw.MathExpression({
      expression: '100 - 100 * errors / MAX([errors, invocations])',
      usingMetrics: {
        errors: errorCount,
        invocations: invocations,
      },
      period: cdk.Duration.minutes(5),
      label: 'Success rate',
    });
  }

  private lambdaWidget(title: string, metrics: cw.IMetric[]): cw.IWidget {
    return this.createGraphWidget({ title, left: metrics });
  }

  private lambdaMetric(
    functionName: string,
    label: string,
    metricName: string,
    statistic: cw.Statistic,
    unit?: cw.Unit,
  ): cw.IMetric {
    return this.createGraphMetric({
      label,
      metricName,
      namespace: 'AWS/Lambda',
      statistic,
      unit,
      dimensionsMap: { FunctionName: functionName },
    });
  }

  private createDynamoDbWidgets(dynamoDbTable: { tableName: string; friendlyTableName?: string }): cw.IWidget[] {
    const prefix = dynamoDbTable.friendlyTableName ?? dynamoDbTable.tableName;
    return [
      this.ddbWidget(`${prefix} - Capacity`, [
        this.ddbMetric(
          dynamoDbTable.tableName,
          'Provisioned Read',
          'ProvisionedReadCapacityUnits',
          cw.Statistic.AVERAGE,
          cw.Unit.COUNT,
        ),
        this.ddbMetric(
          dynamoDbTable.tableName,
          'Consumed Read',
          'ConsumedReadCapacityUnits',
          cw.Statistic.AVERAGE,
          cw.Unit.COUNT,
        ),
        this.ddbMetric(
          dynamoDbTable.tableName,
          'Provisioned Write',
          'ProvisionedWriteCapacityUnits',
          cw.Statistic.AVERAGE,
          cw.Unit.COUNT,
        ),
        this.ddbMetric(
          dynamoDbTable.tableName,
          'Consumed Write',
          'ConsumedWriteCapacityUnits',
          cw.Statistic.AVERAGE,
          cw.Unit.COUNT,
        ),
      ]),
      this.ddbWidget(`${prefix} - Latency`, [
        this.ddbMetric(
          dynamoDbTable.tableName,
          'Get Latency',
          'SuccessfulRequestLatency',
          cw.Statistic.AVERAGE,
          cw.Unit.MILLISECONDS,
          { Operation: 'GetItem' },
        ),
        this.ddbMetric(
          dynamoDbTable.tableName,
          'Put Latency',
          'SuccessfulRequestLatency',
          cw.Statistic.AVERAGE,
          cw.Unit.MILLISECONDS,
          { Operation: 'PutItem' },
        ),
        this.ddbMetric(
          dynamoDbTable.tableName,
          'Scan Latency',
          'SuccessfulRequestLatency',
          cw.Statistic.AVERAGE,
          cw.Unit.MILLISECONDS,
          { Operation: 'Scan' },
        ),
        this.ddbMetric(
          dynamoDbTable.tableName,
          'Query Latency',
          'SuccessfulRequestLatency',
          cw.Statistic.AVERAGE,
          cw.Unit.MILLISECONDS,
          { Operation: 'Query' },
        ),
      ]),
      this.ddbWidget(`${prefix} - Errors`, [
        this.ddbMetric(dynamoDbTable.tableName, 'Get', 'SystemErrors', cw.Statistic.SUM, cw.Unit.COUNT, {
          Operation: 'GetItem',
        }),
        this.ddbMetric(dynamoDbTable.tableName, 'Batch Get', 'SystemErrors', cw.Statistic.SUM, cw.Unit.COUNT, {
          Operation: 'BatchGetItem',
        }),
        this.ddbMetric(dynamoDbTable.tableName, 'Scan', 'SystemErrors', cw.Statistic.SUM, cw.Unit.COUNT, {
          Operation: 'Scan',
        }),
        this.ddbMetric(dynamoDbTable.tableName, 'Query', 'SystemErrors', cw.Statistic.SUM, cw.Unit.COUNT, {
          Operation: 'Query',
        }),
        this.ddbMetric(dynamoDbTable.tableName, 'Put', 'SystemErrors', cw.Statistic.SUM, cw.Unit.COUNT, {
          Operation: 'PutItem',
        }),
        this.ddbMetric(dynamoDbTable.tableName, 'Batch Write', 'SystemErrors', cw.Statistic.SUM, cw.Unit.COUNT, {
          Operation: 'BatchWriteItem',
        }),
        this.ddbMetric(dynamoDbTable.tableName, 'Update', 'SystemErrors', cw.Statistic.SUM, cw.Unit.COUNT, {
          Operation: 'UpdateItem',
        }),
        this.ddbMetric(dynamoDbTable.tableName, 'Delete', 'SystemErrors', cw.Statistic.SUM, cw.Unit.COUNT, {
          Operation: 'DeleteItem',
        }),
      ]),
      this.ddbWidget(`${prefix} - Throttled Requests`, [
        this.ddbMetric(
          dynamoDbTable.tableName,
          'Throttled Requests',
          'ThrottledRequests',
          cw.Statistic.SUM,
          cw.Unit.COUNT,
        ),
      ]),
    ];
  }

  private ddbMetric(
    tableName: string,
    label: string,
    metricName: string,
    statistic: cw.Statistic,
    unit?: cw.Unit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dimensions?: Record<string, any>,
  ): cw.IMetric {
    return this.createGraphMetric({
      label,
      metricName,
      statistic,
      namespace: 'AWS/DynamoDB',
      unit,
      dimensionsMap: { ...dimensions, TableName: tableName },
    });
  }

  private ddbWidget(title: string, metrics: cw.IMetric[]): cw.IWidget {
    return this.createGraphWidget({ title, left: metrics });
  }

  private createGraphWidget(props: cw.GraphWidgetProps): cw.GraphWidget {
    return new cw.GraphWidget({
      height: 6,
      width: 6,
      liveData: true,
      ...props,
    });
  }

  private createGraphMetric(props: cw.MetricProps): cw.IMetric {
    return new cw.Metric({ ...props });
  }
}
