/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as iam from 'aws-cdk-lib/aws-iam'
import { ApiDeployStack } from './deployment';
import { ApiError } from '../common';
import { Aspects, Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  AuthorizationType,
  CfnAccount,
  CfnRestApi,
  Cors,
  RequestAuthorizer,
  Resource,
  ResourceOptions,
  ResponseType,
  RestApi,
  RestApiProps
} from 'aws-cdk-lib/aws-apigateway';
import { Bucket } from '../../../constructs/s3/bucket';
import { Construct } from 'constructs';
import { DecoratedResource, IDecoratedResource, IDecoratedRestApi } from './decorator';
import { ExposedModel, ExposedRequestValidator, StatusCodes } from './types';
import { OpenApiDefinition } from './openapi';
import { PublicOPTIONSMethodAspect, ThrottleApiResourceDeploymentAspect } from './apsects';
import { getRootStack } from '../../../../utils/stack-utils';
import { getUniqueName } from '@ada/cdk-core';

export * from './types';

export * from './decorator';

export * from './apsects';

export * from './deployment';

export * from './openapi';

export interface BaseRestApiProps extends Omit<RestApiProps, 'deploy'> {
  customAuthorizer: RequestAuthorizer;
  accessLogsBucket: Bucket;
}

/**
 * Base RestAPI for enhancing api and resources.
 *
 * - Support auto updating api model when resources/methods are added.
 */
export class BaseRestApi extends RestApi implements IDecoratedRestApi {
  readonly errorModel: ExposedModel;
  readonly requestValidator: ExposedRequestValidator;
  readonly openapi: OpenApiDefinition;

  /**
   * Reference to API stored at root stack level to decouple microservice stack dependencies.
   */
  readonly apiRef: IDecoratedRestApi;

  /**
   * The stack that controls the deployment (root level).
   */
  readonly deployStack: ApiDeployStack;

  get decoratedRoot(): IDecoratedResource {
    return this.decorateResource(this.root as Resource);
  }

  /**
   * Creates a reference to the api that is decoupled but bound to the deployment.
   * @param scope
   * @param id
   */
  createApiRef(scope: Construct, id: string): IDecoratedRestApi {
    const restApiId = this.apiRef ? this.apiRef.restApiId : this.restApiId;
    const rootResourceId = this.apiRef ? this.apiRef.restApiRootResourceId : this.restApiRootResourceId;

    const apiRef = RestApi.fromRestApiAttributes(scope, id, {
      restApiId,
      rootResourceId,
    });

    // HACK: to enable automatic dependencies of deployment via the decoupled api references
    // Without this hack we would have to replicate the follow functionality throughout.
    // https://github.com/aws/aws-cdk/blob/v1.121.0/packages/%40aws-cdk/aws-apigateway/lib/method.ts#L223
    // https://github.com/aws/aws-cdk/blob/v1.121.0/packages/%40aws-cdk/aws-apigateway/lib/resource.ts#L26
    // https://github.com/aws/aws-cdk/blob/v1.121.0/packages/%40aws-cdk/aws-apigateway/lib/resource.ts#L456
    // https://github.com/aws/aws-cdk/blob/v1.121.0/packages/%40aws-cdk/aws-apigateway/lib/restapi.ts#L37
    if (this.deployStack) {
      Object.assign(apiRef, {
        deploymentStage: this.deployStack.stage,
        _latestDeployment: this.deployStack.deployment,
      });
    }

    return Object.assign(apiRef, {
      errorModel: this.errorModel,
      requestValidator: this.requestValidator,
      openapi: this.openapi,
      createApiRef: this.createApiRef.bind(this),
    } as IDecoratedRestApi);
  }

  constructor(scope: Construct, id: string, props: BaseRestApiProps) {
    super(scope, id, {
      defaultMethodOptions: {
        authorizationType: AuthorizationType.CUSTOM, // NOTE: this is removed for OPTIONS methods via aspect below
        authorizer: props.customAuthorizer,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowHeaders: ['Authorization', '*'],
        statusCode: 200,
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
        maxAge: Duration.seconds(600), // 10 minutes
      },
      restApiName: getUniqueName(scope, props.restApiName || id),
      ...props,
      // force deployment to be handled in separate stack
      // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-apigateway-readme.html#breaking-up-methods-and-resources-across-stacks
      deploy: false,
      deployOptions: undefined,
      cloudWatchRole: false
    });

    // configure destroyable CfnAccount and APIGateway CloudWatchRole
    this.configureCloudWatchRole((this.node.defaultChild) as CfnRestApi)

    const rootStack = getRootStack(this);

    // create api reference at root stack level to decouople services and deployment
    this.apiRef = this.createApiRef(rootStack, `${id}-RestApiRef`);

    // Scope the deployment stack to root stack to break circular-dependencies
    // between api stack and stacks that contribute to api definition (which deployment depends on)
    this.deployStack = new ApiDeployStack(rootStack, 'FederatedApiDeployment', {
      restApiRef: this.apiRef,
      deployOptions: props.deployOptions,
      accessLogsBucket: props.accessLogsBucket,
    });

    this.deploymentStage = this.deployStack.stage;

    Aspects.of(rootStack).add(new PublicOPTIONSMethodAspect());
    Aspects.of(rootStack).add(new ThrottleApiResourceDeploymentAspect());

    // Return the json schema validation error message when an invalid input is supplied
    this.addGatewayResponse('GatewayResponse-BAD_REQUEST_BODY', {
      type: ResponseType.BAD_REQUEST_BODY,
      statusCode: String(StatusCodes.BAD_REQUEST),
      templates: {
        'application/json': `{"message": "$context.error.validationErrorString"}`,
      },
      // Specify cors headers for validation errors
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
      },
    });
    // Do not expose 500 errors to client as could identity vulnerability to maliscious parties
    this.addGatewayResponse('GatewayResponse-DEFAULT_5XX', {
      type: ResponseType.DEFAULT_5XX,
      statusCode: String(StatusCodes.CONFLICT),
      templates: {
        'application/json': `{"statusCode": "'409'", "message": "Failed to service request", "resourcePath": "$context.resourcePath",`,
      },
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'*'",
      },
    });

    this.errorModel = new ExposedModel(this, `${id}-ErrorModel`, {
      restApi: this.apiRef,
      contentType: 'application/json',
      schema: ApiError,
    });

    this.requestValidator = new ExposedRequestValidator(this, `${id}-Validator`, {
      restApi: this.apiRef,
      validateRequestParameters: true,
      validateRequestBody: true,
      requestValidatorName: `${id}-Validator`,
    });

    this.openapi = new OpenApiDefinition(this, 'OpenApiDefinition');
  }

  addRootResource(pathPart: string, options?: ResourceOptions): IDecoratedResource {
    return this.decoratedRoot.addResource(pathPart, options);
  }

  protected configureCloudWatchRole(apiResource: CfnRestApi): void {
    const role = new iam.Role(this, 'CloudWatchRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayPushToCloudWatchLogs')],
    });
    role.applyRemovalPolicy(RemovalPolicy.DESTROY);

    this.cloudWatchAccount = new CfnAccount(this, 'Account', {
      cloudWatchRoleArn: role.roleArn,
    });
    this.cloudWatchAccount.applyRemovalPolicy(RemovalPolicy.DESTROY);
    this.cloudWatchAccount.node.addDependency(apiResource);
  }

  protected decorateResource(resource: Resource): IDecoratedResource {
    return DecoratedResource(this, resource);
  }
}
