/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { AppRegistry } from '../common/aspects/app-registry';
import { Aspects, CfnOutput, StackProps } from 'aws-cdk-lib';
import { BUNDLING_STACKS, DISABLE_ASSET_STAGING_CONTEXT } from 'aws-cdk-lib/cx-api';
import { Construct } from 'constructs';
import { Dashboard } from '@ada/infra-common/constructs/cloudwatch/dashboard';
import { DeploymentMetricsCollection } from '../common/constructs/deployment-metrics';
import { ExtendedStack, InputParameters, NamespaceGlobalUUID, RetainedAspect } from '@ada/cdk-core';
import { IdentityServiceStack } from '../services/identity/stack';
import { NotificationBus } from '../services/api/components/notification/constructs/bus';
import { OperationalMetricsConfig, applyApplicationTags } from '@ada/infra-common';
import { WebAclRuleProvider } from '@ada/infra-common/constructs/waf/WebAclRuleProvider';
import { solutionInfo } from '@ada/common';
import AdministrationServiceStack from '../services/administration/stack';
import ApiServiceStack from '../services/api/stack';
import CognitoAuthStack from '../nested-stacks/cognito-auth-stack';
import CommonStack from '../nested-stacks/common-stack';
import DataProductServiceStack from '../services/data-product/stack';
import GovernanceServiceStack from '../services/governance/stack';
import NotificationServiceStack from '../services/notification/stack';
import OntologyServiceStack from '../services/ontology/stack';
import QueryParseRenderServiceStack from '../services/query-parse-render/stack';
import QueryServiceStack from '../services/query/stack';
import StaticWebsiteStack from '../nested-stacks/static-website-stack';
import UploadWebsiteConfiguration from '../common/constructs/lambda/upload-website-configuration';

export interface AdaStackProps extends StackProps {
  readonly namespace?: string;
}

/**
 * The main cloudformation stack for the solution. Contains nested stacks and top level resources.
 */
export class AdaStack extends ExtendedStack {
  public readonly websiteUrl: CfnOutput;
  public readonly cognitoUserPoolId: CfnOutput;
  public readonly userPoolClientId: CfnOutput;
  public readonly baseApiUrl: CfnOutput;
  public readonly athenaProxyUrl: CfnOutput;

  constructor(construct: Construct, id?: string, props?: AdaStackProps) {
    const solution = solutionInfo();
    // default the stack name for consistency (but allow override for testing)
    id = id || solution.name;

    super(construct, id, props);

    // NB: must come before any child constructs
    if (process.env.NODE_ENV !== 'production' && process.env.DISABLE_CDK_BUNDLING) {
      console.warn('CDK BUNDLING IS DISABLED');
      this.node.setContext(BUNDLING_STACKS, []);
      this.node.setContext(DISABLE_ASSET_STAGING_CONTEXT, true);
    }
    // creates CfnOutput with value containing list of all retained resources during solution deletion.
    new RetainedAspect(this); //NOSONAR (S1848) - cdk construct is used

    // provider to set of WAF WebACL rules that includes user defined rules in cdk context
    new WebAclRuleProvider(this); //NOSONAR (S1848) - cdk construct is used

    const parameters = new InputParameters(this);

    // Create a globally unique uuid on initial deployment used to generate
    // unique resource names when explicit naming is required.
    // Resource that do not require explit name we let CloudFormation auto-generate.
    const globalUUID = new NamespaceGlobalUUID(this);

    applyApplicationTags(this);

    const appRegistryAspect = new AppRegistry(this, 'AppRegistry', {
      solutionId: solution.awsSolutionId,
      solutionVersion: solution.awsSolutionVersion,
      solutionName: solution.title,
      applicationType: 'AWS-Solutions',
      applicationName: 'Automated-Data-Analysis-on-AWS',
    });

    Aspects.of(this).add(appRegistryAspect);

    const deploymentMetrics = new DeploymentMetricsCollection(this, 'OpMetrics', {
      sendAnonymousData: parameters.sendAnonymousData,
    });

    // common props for anonymized operational data collection in services
    const operationalMetricsConfig: OperationalMetricsConfig = {
      awsSolutionId: solution.awsSolutionId,
      awsSolutionVersion: solution.awsSolutionVersion,
      anonymousDataUUID: deploymentMetrics.anonymousDataUUID,
      sendAnonymousData: deploymentMetrics.sendAnonymousData,
    };

    const {
      executeAthenaQueryLambdaRoleArn,
      cachedQueryTable,
      counterTable,
      internalTokenKey,
      entityManagementTables,
      athenaOutputBucket,
      accessLogsBucket,
    } = new CommonStack(this, 'CommonStack', {});

    const cognitoStack = new CognitoAuthStack(this, 'CognitoAuth', {
      adminEmailAddress: parameters.adminEmail,
      adminPhoneNumber: parameters.adminPhoneNumber,
      adminMFA: parameters.adminMFA,
      advancedSecurityMode: parameters.advancedSecurityMode,
    });
    const notificationBus = new NotificationBus(this, 'NotificationBus');

    const apiService = new ApiServiceStack(this, 'ApiService', {
      adaUserPoolProps: cognitoStack.adaCognitoProps,
      userPool: cognitoStack.userPool,
      userIdScope: cognitoStack.userIdScope,
      cognitoDomain: cognitoStack.cognitoDomain,
      autoAssociateAdmin: parameters.autoAssociateAdmin,
      adminEmailAddress: parameters.adminEmail,
      notificationBus,
      counterTable,
      internalTokenKey,
      entityManagementTables,
      accessLogsBucket,
    });
    const api = apiService.api;

    const commonServiceProps = {
      federatedApi: api,
      notificationBus,
      counterTable,
      internalTokenKey,
      entityManagementTables,
      operationalMetricsConfig,
    };

    const notificationService = new NotificationServiceStack(this, 'NotificationService', {
      ...commonServiceProps,
    });
    const queryParseRenderService = new QueryParseRenderServiceStack(this, 'QueryParseRenderService', {
      ...commonServiceProps,
      executeAthenaQueryLambdaRoleArn,
    });
    const governanceService = new GovernanceServiceStack(this, 'GovernanceService', {
      ...commonServiceProps,
    });
    const ontologyService = new OntologyServiceStack(this, 'OntologyService', {
      ...commonServiceProps,
    });
    const dataProductService = new DataProductServiceStack(this, 'DataProductService', {
      ...commonServiceProps,
      governanceApi: governanceService.api,
      ontologyApi: ontologyService.api,
      executeAthenaQueryLambdaRoleArn,
      cachedQueryTable,
      queryParseRenderApi: queryParseRenderService.api,
      athenaOutputBucket,
      accessLogsBucket,
    });

    const queryService = new QueryServiceStack(this, 'QueryService', {
      ...commonServiceProps,
      executeAthenaQueryLambdaRoleArn,
      queryParseRenderApi: queryParseRenderService.api,
      dataProductApi: dataProductService.api,
      ontologyApi: ontologyService.api,
      governanceApi: governanceService.api,
      cachedQueryTable,
      glueKmsKey: dataProductService.glueKmsKey,
      athenaOutputBucket,
      cognitoDomain: cognitoStack.cognitoDomain,
      accessLogsBucket,
    });

    const administrationService = new AdministrationServiceStack(this, 'AdministrationService', {
      ...commonServiceProps,
      dataBuckets: dataProductService.dataBuckets,
      dataProductCreationStateMachine: dataProductService.dataProductCreationStateMachine,
      dataProductTable: dataProductService.dataProductTable,
      coreStack: this,
    });

    const web = new StaticWebsiteStack(this, 'Website', {
      namespace: props?.namespace || 'Ada',
      accessLogsBucket,
      contentSecurityPolicy: {
        // list all urls/domains that the website needs to connect to for HTTP requests
        // For S3 buckets ensure we support variants (url + virtualHostedUrl)
        'connect-src': [
          api.url,
          // Auth - congito oauth urls
          `https://${cognitoStack.cognitoDomain}`,
          `https://cognito-idp.${this.region}.amazonaws.com`,
          // File Upload - bucket where user uploads data product files
          dataProductService.fileUploadBucket.urlForObject(),
          dataProductService.fileUploadBucket.virtualHostedUrlForObject(undefined, { regional: true }),
          dataProductService.fileUploadBucket.virtualHostedUrlForObject(undefined, { regional: false }),
          // Query download - from athena query results bucket
          athenaOutputBucket.urlForObject(),
          athenaOutputBucket.virtualHostedUrlForObject(undefined, { regional: true }),
          athenaOutputBucket.virtualHostedUrlForObject(undefined, { regional: false }),
        ],
      },
    });

    const identityService = new IdentityServiceStack(this, 'IdentityService', {
      accessRequestTable: apiService.accessRequestTable,
      apiAccessPolicyTable: apiService.apiAccessPolicyTable,
      groupTable: apiService.groupTable,
      machineTable: apiService.machineTable,
      tokenTable: apiService.tokenTable,
      federatedApi: api,
      cognitoDomain: cognitoStack.cognitoDomain,
      counterTable,
      entityManagementTables,
      internalTokenKey,
      notificationBus,
      userIdScope: cognitoStack.userIdScope,
      userPool: cognitoStack.userPool,
      callbackUrls: web.callbackUrls,
      logoutUrls: web.logoutUrls,
    });

    // HACK: add temporary "dependencies" between microservice to prevent deployment limit issue - https://github.com/aws/aws-cdk/issues/9521
    // Do not allow disabling for tests or will break snapshots
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'test' && process.env.ADA_DISABLE_SERVICE_DEPLOYMENT_THROTTLE === 'true') {
      console.warn(
        'ADA_DISABLE_SERVICE_DEPLOYMENT_THROTTLE: disabling forced deps can cause "Too Many Requests (Service: ApiGateway, Status Code: 429"',
      );
    } else {
      const microservices = [
        notificationService,
        queryParseRenderService,
        dataProductService,
        governanceService,
        // queryService, // already has dependencies
        ontologyService,
        administrationService,
      ];
      for (let i = 1; i < microservices.length; i++) {
        microservices[i].node.addDependency(microservices[i - 1]);
      }
    }

    new UploadWebsiteConfiguration(this, 'UploadWebsiteConfiguration', {
      bucketDeployment: web.bucketDeployment,
      cloudFrontDistribution: web.cloudFrontDistribution,
      websiteBucket: web.websiteBucket,
      configuration: {
        userPoolId: cognitoStack.userPool.userPoolId,
        userPoolClientId: identityService.userPoolClient.userPoolClientId,
        apiUrl: api.url,
        region: this.region,
        accountId: this.account,
        oauthScopes: identityService.oauthScopes.map((q) => q.scopeName),
        oauthDomain: cognitoStack.cognitoDomain,
        ouathResponseType: 'code',
        athenaProxyApiUrl: `${queryService.proxyDistributionDomain}:443`,
      },
    });

    this.exportValue(globalUUID.uuid, { name: 'NamespaceGlobalUUID' });

    this.cognitoUserPoolId = new CfnOutput(this, 'CognitoUserPoolId', {
      value: cognitoStack.userPool.userPoolId,
      exportName: 'CognitoUserPoolId',
    });
    this.userPoolClientId = new CfnOutput(this, 'UserPoolClientId', {
      value: identityService.userPoolClient.userPoolClientId,
      exportName: 'UserPoolClientId',
    });
    this.websiteUrl = new CfnOutput(this, 'WebsiteUrl', {
      value: `https://${web.cloudFrontDistribution.distributionDomainName}/`,
      exportName: 'WebsiteUrl',
    });
    this.baseApiUrl = new CfnOutput(this, 'BaseApiUrl', {
      value: api.url,
      exportName: 'BaseApiUrl',
    });
    this.athenaProxyUrl = new CfnOutput(this, 'AthenaProxyApiUrl', {
      value: `${queryService.proxyDistributionDomain}:443`,
      exportName: 'AthenaProxyApiUrl',
    });

    new Dashboard(this, 'dashboard', {
      dataProductApi: dataProductService.api,
      domainTable: dataProductService.domainTable,
      dataProductTable: dataProductService.dataProductTable,
      queryApi: queryService.api,
      administrationApi: administrationService.api,
      governanceApi: governanceService.api,
      ontologyApi: ontologyService.api,
      queryParserApi: queryParseRenderService.api,
    });

    // Data Ingress Gateway
    new CfnOutput(this, 'DataIngressNetworkCIDR', {
      value: dataProductService.dataIngressGateway.dataIngressNetworkCidr,
      exportName: 'DataIngressNetworkCIDR',
    });

    new CfnOutput(this, 'DataIngressVPCCIDR', {
      value: dataProductService.dataIngressGateway.dataIngressVPCCidr,
      exportName: 'DataIngressVPCCIDR',
    });

    new CfnOutput(this, 'DataIngressTransitGatewayId', {
      value: dataProductService.dataIngressGateway.transiteGatewayId,
      exportName: 'DataIngressTransitGatewayId',
    });

    new CfnOutput(this, 'DataSourceVPCAttachmentRouteTableId', {
      value: dataProductService.dataIngressGateway.dataSourceVPCAttachmentRouteTableId,
      exportName: 'DataSourceVPCAttachmentRouteTableId',
    });

    new CfnOutput(this, 'DataSourceVPCAttachmentPropogationRouteTableId', {
      value: dataProductService.dataIngressGateway.dataSourceVPCAttachmentPropogationRouteTableId,
      exportName: 'DataSourceVPCAttachmentPropogationRouteTableId',
    });
  }
}

export default AdaStack;
