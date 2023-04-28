/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import {
  AccessLogFormat,
  CfnDeployment,
  CfnStage,
  Deployment,
  IRestApi,
  LogGroupLogDestination,
  MethodLoggingLevel,
  RestApi,
  Stage,
  StageOptions,
  StageProps,
} from 'aws-cdk-lib/aws-apigateway';
import { AdditionalHeaders } from '@ada/common';
import { Bucket } from '../../../../common/constructs/s3/bucket';
import { CfnDeliveryStream } from 'aws-cdk-lib/aws-kinesisfirehose';
import { CfnLoggingConfiguration, CfnWebACL, CfnWebACLAssociation } from 'aws-cdk-lib/aws-wafv2';
import { CfnResource, Duration, NestedStackProps, RemovalPolicy, Size, Stack, Token } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DeliveryStream, StreamEncryption } from '@aws-cdk/aws-kinesisfirehose-alpha';
import { ExtendedNestedStack, addCfnNagSuppressions, getUniqueWafFirehoseDeliveryStreamName } from '@ada/cdk-core';
import { LogGroup } from '../../../../common/constructs/cloudwatch/log-group';
import { S3Bucket } from '@aws-cdk/aws-kinesisfirehose-destinations-alpha';
import { WebAclRuleProvider } from '../../waf/WebAclRuleProvider';
import { getRootStack } from '../../../../utils/stack-utils';

// https://docs.aws.amazon.com/cdk/api/latest/docs/aws-apigateway-readme.html#breaking-up-methods-and-resources-across-stacks
interface ApiDeployStackProps extends NestedStackProps {
  readonly restApiRef: IRestApi;
  readonly deployOptions?: StageOptions;
  readonly accessLogsBucket: Bucket;
}

/**
 * `ApiDeployStack` decouples the deployment from Api stack to enable defining resources/methods/etc within
 * separate "service" based stacks. To prevent circular dependencies, the deploy stack is always added
 * to the root stack.
 *
 * @see https://docs.aws.amazon.com/cdk/api/latest/docs/aws-apigateway-readme.html#breaking-up-methods-and-resources-across-stacks
 */
export class ApiDeployStack extends ExtendedNestedStack {
  readonly deployment: Deployment;
  readonly stage: Stage;
  readonly accessLogsBucket: Bucket;

  constructor(scope: Construct, id: string, props: ApiDeployStackProps) {
    scope = getRootStack(scope);
    super(scope, id, props);

    if (props.restApiRef instanceof RestApi) {
      throw new Error(
        'DeployStack requires reference to the RestApi (IRestApi) and not actual api contrust to prevent circular dependencies.',
      );
    }

    this.accessLogsBucket = props.accessLogsBucket;
    const deployOptions: StageOptions = {
      tracingEnabled: true,
      dataTraceEnabled: true,
      metricsEnabled: true,
      loggingLevel: MethodLoggingLevel.INFO,
      accessLogDestination: new LogGroupLogDestination(
        new LogGroup(this, 'AccessLogDestinationLogs', { removalPolicy: RemovalPolicy.DESTROY }),
      ),
      // https://www.alexdebrie.com/posts/api-gateway-access-logs/#cloud-development-kit-cdk
      accessLogFormat: AccessLogFormat.custom(
        '{"requestTime":"$context.requestTime","requestId":"$context.requestId","httpMethod":"$context.httpMethod","path":"$context.path","resourcePath":"$context.resourcePath","status":$context.status,"responseLatency":$context.responseLatency,"xrayTraceId":"$context.xrayTraceId","integrationRequestId":"$context.integration.requestId","functionResponseStatus":"$context.integration.status","integrationLatency":"$context.integration.latency","integrationServiceStatus":"$context.integration.integrationStatus","authorizeStatus":"$context.authorize.status","authorizerStatus":"$context.authorizer.status","authorizerLatency":"$context.authorizer.latency","authorizerRequestId":"$context.authorizer.requestId","ip":"$context.identity.sourceIp","userAgent":"$context.identity.userAgent","principalId":"$context.authorizer.principalId"}',
      ),
      ...(props.deployOptions || {}),
    };

    this.deployment = new Deployment(this, 'Deployment', {
      api: props.restApiRef,
    });
    addCfnNagSuppressions(this.deployment.node.defaultChild as CfnDeployment, [
      {
        id: 'W68',
        reason: 'No UsagePlan required for api',
      },
    ]);
    // stageName must be literal to prevent ciruclar dependencies
    // https://github.com/aws/aws-cdk/blob/v1.121.0/packages/%40aws-cdk/aws-apigateway/lib/method.ts#L255
    this.stage = new DecoupledStage(this, 'Stage', { ...deployOptions, deployment: this.deployment });
    addCfnNagSuppressions(this.stage.node.defaultChild as CfnStage, [
      {
        id: 'W64',
        reason: 'No UsagePlan required for api',
      },
    ]);
    this.configureWAF(
      `arn:aws:apigateway:${this.region}::/restapis/${props.restApiRef.restApiId}/stages/${this.stage.stageName}`,
    );
  }

  public configureWAF(apiGatewayArn: string) {
    const webACL = new CfnWebACL(this, 'WebACL', {
      defaultAction: {
        allow: {},
      },
      scope: 'REGIONAL',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'webACL',
        sampledRequestsEnabled: true,
      },
      rules: WebAclRuleProvider.getRules(this, 'REGIONAL'),
    });

    const logbucket = new Bucket(this, 'WafLogBucket', {
      // bucketName: 'waf-logs-apigateway',
      serverAccessLogsBucket: this.accessLogsBucket,
      serverAccessLogsPrefix: 'waf-logs-apigateway/',
      retain: false,
    });

    const deliveryLogGroup = new LogGroup(this, 'WafLogsS3DeliveryLogGroup', { removalPolicy: RemovalPolicy.DESTROY });
    const deliveryStream = new DeliveryStream(this, 'WafLogsDelivery', {
      deliveryStreamName: getUniqueWafFirehoseDeliveryStreamName(this, 'delivery-stream'),
      encryption: StreamEncryption.AWS_OWNED,
      destinations: [
        new S3Bucket(logbucket, {
          // use max values as default
          bufferingInterval: Duration.seconds(900),
          bufferingSize: Size.mebibytes(128),
          logGroup: deliveryLogGroup,
        }),
      ],
    });
    (deliveryStream.node.findChild('Resource') as CfnDeliveryStream).applyRemovalPolicy(RemovalPolicy.DESTROY);
    (deliveryLogGroup.node.findChild('S3Destination').node.findChild('Resource') as CfnResource).applyRemovalPolicy(
      RemovalPolicy.DESTROY,
    );

    new CfnLoggingConfiguration(this, 'WafLogConfiguration', { //NOSONAR (typescript:S1848) - cdk construct is used
      resourceArn: webACL.attrArn,
      logDestinationConfigs: [deliveryStream.deliveryStreamArn],
      // NOTE: consider adding additional fields
      redactedFields: [
        {
          singleHeader: { Name: 'Authorization' },
        },
        {
          singleHeader: { Name: AdditionalHeaders.ID_TOKEN },
        },
      ],
    });

    // Associate with our gateway
    const cfnWebAssociation = new CfnWebACLAssociation(this, 'WafWebACLAssociation', {
      webAclArn: webACL.attrArn,
      resourceArn: apiGatewayArn,
    });

    cfnWebAssociation.addDependency(this.deployment.node.defaultChild as CfnResource);
    cfnWebAssociation.addDependency(this.stage.node.defaultChild as CfnResource);
  }
}

class DecoupledStage extends Stage {
  private readonly _url: string;

  constructor(scope: Construct, id: string, props: StageProps) {
    super(scope, id, props);

    let stageName = props.stageName;

    // Force stage name to be literal, otherwise creates circular dependency
    if (stageName == null || Token.isUnresolved(stageName)) {
      stageName = 'prod';
    }

    this._url = `https://${this.restApi.restApiId}.execute-api.${Stack.of(this).region}.amazonaws.com/${stageName}`;
    // @ts-ignore override read-only value - https://github.com/aws/aws-cdk/blob/v1.121.0/packages/%40aws-cdk/aws-apigateway/lib/stage.ts#L255
    this.stageName = stageName;
  }

  /**
   * @override Decouple to prevent circular dependencies
   */
  urlForPath(path: string | undefined): string {
    if (path == null) return this._url;
    return `${this._url}/${normalizePath(path)}`;
  }
}

function normalizePath(path: string): string {
  if (path.startsWith('/')) path = path.substring(1); // remove root slash
  return path;
}
