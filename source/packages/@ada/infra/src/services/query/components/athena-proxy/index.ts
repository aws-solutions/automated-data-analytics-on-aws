/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as fs from 'fs-extra';
import { Bucket } from '../../../../common/constructs/s3/bucket';
import { CfnStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { Construct } from 'constructs';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { FederatedRestApi } from '@ada/infra-common/constructs/api';
import { HttpApi, HttpMethod } from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { LogGroup } from '../../../../common/constructs/cloudwatch/log-group';
import { SolutionContext, TypescriptFunction, tryGetSolutionContext } from '@ada/infra-common';
import { WebAclRuleProvider } from '../../../../common/constructs/waf/WebAclRuleProvider';
import {
  addCfnNagSuppressions,
  addCfnNagSuppressionsToRolePolicy,
  getUniqueName,
  getUniqueNameWithSolution,
  getUniqueVendedLogGroupName,
} from '@ada/cdk-core';
import { minify } from 'uglify-js';
import CloudFrontWebAcl from '../../../../common/constructs/waf/cloud-front-web-acl';

export interface AthenaProxyApiRoutesProps {
  readonly federatedApi: FederatedRestApi;
  readonly cognitoDomain: string;
  readonly accessLogsBucket: Bucket;
}

export class AthenaProxyApiRoutes extends Construct {
  public readonly proxyApi: HttpApi;
  public readonly proxyDistributionDomain: string;

  constructor(scope: Construct, id: string, props: AthenaProxyApiRoutesProps) {
    super(scope, id);
    const { federatedApi, cognitoDomain } = props;

    // Utility method for lambda handlers
    const buildLambda = (handlerFile: string) =>
      new TypescriptFunction(this, `Lambda-${handlerFile}`, {
        package: 'query-service',
        handlerFile: require.resolve(`./handlers/${handlerFile}`),
        timeout: Duration.minutes(15),
        environment: {
          COGNITO_DOMAIN: cognitoDomain,
        },
        apiLayer: {
          endpoint: federatedApi.url,
        },
      });

    const athenaProxyLambda = buildLambda('athena-proxy');

    athenaProxyLambda.addToRolePolicy(
      new PolicyStatement({
        actions: ['logs:CreateLogGroup', 'logs:PutLogEvents', 'logs:CreateLogStream'],
        resources: ['*'],
        effect: Effect.ALLOW,
      }),
    );

    this.proxyApi = new HttpApi(this, 'HttpApi', {
      // CDK HttpApi construct automatically forces `apiName => id` if undefined, so we need to ensure is unique
      apiName: getUniqueNameWithSolution(this, 'AthenaProxy'),
      description: 'Athena Proxy Api Gateway',
      createDefaultStage: true,
    });

    const defaultSage = this.proxyApi.defaultStage?.node.defaultChild as CfnStage;
    const accessLogs = new LogGroup(this, 'AccessLog', {
      logGroupName: getUniqueVendedLogGroupName(this, 'apigateway', 'HttpApiAccessLogs'),
      removalPolicy: RemovalPolicy.DESTROY,
    });
    defaultSage.accessLogSettings = {
      destinationArn: accessLogs.logGroupArn,
      format: JSON.stringify({
        requestTime: '$context.requestTime',
        requestId: '$context.requestId',
        httpMethod: '$context.httpMethod',
        path: '$context.path',
        status: '$context.status',
        responseLatency: '$context.responseLatency',
        integrationRequestId: '$context.integration.requestId',
        functionResponseStatus: '$context.integration.status',
        integrationLatency: '$context.integrationLatency',
        integrationServiceStatus: '$context.integrationStatus',
        ip: '$context.identity.sourceIp',
        userAgent: '$context.identity.userAgent',
        principalId: '$context.authorizer.principalId',
      }),
    };

    const role = new Role(this, 'AccessLogsRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
    });

    const policy = new PolicyStatement({
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:DescribeLogGroups',
        'logs:DescribeLogStreams',
        'logs:PutLogEvents',
        'logs:GetLogEvents',
        'logs:FilterLogEvents',
      ],
      resources: ['*'],
    });

    role.addToPolicy(policy);
    accessLogs.grantWrite(role);
    addCfnNagSuppressionsToRolePolicy(role, [
      {
        id: 'W12',
        reason: '* resource required to create log streams',
      },
    ]);

    this.proxyApi.addRoutes({
      path: '/',
      methods: [HttpMethod.ANY],
      integration: new HttpLambdaIntegration('LambdaProxy', athenaProxyLambda),
    });

    const stack = Stack.of(this);
    // Web ACL (unless disabled by the context)
    let webAcl: CloudFrontWebAcl | undefined;
    // apply WAF if it is not explicitly disabled
    if (!tryGetSolutionContext(this, SolutionContext.DISABLE_WAF_CLOUDFRONT_WEBACLS)) {
      webAcl = new CloudFrontWebAcl(this, 'CloudFrontWebAcl', {
        // CDK defaults `name => id`; so we need to ensure unique
        name: getUniqueName(this, 'AthenaProxyAcl'),
        suffix: 'athena-proxy-webacl',
        accessLogsBucket: props.accessLogsBucket,
        rules: WebAclRuleProvider.getRulesForSdkCall(this, 'CLOUDFRONT'),
      });
    }

    const viewerResponseFunction = new cloudfront.Function(this, 'ViewerResponseFunction', {
      functionName: getUniqueNameWithSolution(this, 'AthenaProxyViewerResponse'),
      code: cloudfront.FunctionCode.fromInline(
        minify(fs.readFileSync(require.resolve('./handlers/cloudfront-function'), { encoding: 'utf-8' }), {
          keep_fnames: true,
          mangle: false,
        }).code,
      ),
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      webAclId: webAcl?.webAclArn,
      defaultBehavior: {
        compress: false,
        origin: new HttpOrigin(`${this.proxyApi.apiId}.execute-api.${stack.region}.amazonaws.com`),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        // empty behaviour to "simulate" legacy cache behaviour
        cachePolicy: new cloudfront.CachePolicy(this, 'LegacyCachePolicy', {}),
        originRequestPolicy: new cloudfront.OriginRequestPolicy(this, `LegacyRequestPolicy`, {
          // Explicit name is required
          // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-cloudfront-originrequestpolicy-originrequestpolicyconfig.html
          originRequestPolicyName: getUniqueNameWithSolution(this, 'AthenaProxyLegacyRequestPolicy'),
        }),
        functionAssociations: [
          {
            eventType: cloudfront.FunctionEventType.VIEWER_RESPONSE,
            function: viewerResponseFunction,
          },
        ],
      },
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2018,
      logBucket: props.accessLogsBucket,
      logFilePrefix: 'athena-proxy-cloudfront-logs/',
    });
    const cfnDistribution = distribution.node.defaultChild as cloudfront.CfnDistribution;
    cfnDistribution.addDependency(viewerResponseFunction.node.defaultChild as cloudfront.CfnFunction);
    addCfnNagSuppressions(cfnDistribution, [
      {
        id: 'W70',
        reason:
          'Since the distribution uses the CloudFront domain name, CloudFront automatically sets the security policy to TLSv1 regardless of the value of MinimumProtocolVersion',
      },
    ]);

    this.proxyDistributionDomain = distribution.domainName;
  }
}
