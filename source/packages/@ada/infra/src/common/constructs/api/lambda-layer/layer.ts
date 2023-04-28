/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { CfnResource, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DeploymentSecret } from './secret';
import { ENV_DEVELOPMENT } from '../../../env';
import { NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { addCfnNagSuppressions } from '@ada/cdk-core';
import { getRootStack } from '../../../../utils/stack-utils';

export const API_WAF_ALLOW_RULE_HEADER = 'x-api-waf-allow';

export const API_WAF_ALLOW_RULE_SECRET_ENV = 'API_WAF_ALLOW_RULE_SECRET';

export const API_ENDPOINT_ENV = 'API_ENDPOINT';

const SINGLETON_UUID = 'ApiLambdaLayer-YuwJOA';

const CODE_DIR = path.join(__dirname, 'code');

const EXTERNAL_MODULES = ['@ada/api-client', '@ada/api-client-lambda', 'isomorphic-fetch', 'lodash', 'pluralize'];

export class ApiLambdaLayer extends Construct {
  static of(scope: Construct): ApiLambdaLayer {
    const root = getRootStack(scope);

    const existing = root.node.tryFindChild(SINGLETON_UUID) as ApiLambdaLayer;
    if (existing) {
      return existing;
    }

    return new ApiLambdaLayer(root);
  }

  static get EXTERNAL_MODULES(): string[] {
    return EXTERNAL_MODULES;
  }

  /**
   * Augments the Lambda construct props to exclude modules in bundling that are
   * provided by the lambda layer already.
   *
   * This must be called *before* calling super with the props.
   * @param props
   * @returns
   */
  applyToLambdaProps(props: NodejsFunctionProps): NodejsFunctionProps {
    Object.assign(props, {
      bundling: Object.assign(props.bundling || {}, {
        externalModules: [...(props.bundling?.externalModules || ['aws-sdk']), ...EXTERNAL_MODULES],
      }),
    } as NodejsFunctionProps);

    return props;
  }

  /**
   * Binds the api layer to a lambda.
   * - Adds necessary environment variables
   * - Adds the layer to the lambda layers
   * - Grant necessary permissions
   * @param _lambda
   * @param endpoint
   */
  bind(_lambda: lambda.Function, endpoint: string): void {
    this.applyEnvironment(_lambda, endpoint);

    // Add this layer to the lambda layers
    _lambda.addLayers(this.layer);
  }

  /**
   * Applies environment variables used for the api on given function,
   * and grants necessary permissions.
   * @param _lambda
   * @param endpoint
   */
  applyEnvironment(_lambda: lambda.Function, endpoint: string): void {
    // Ensure the lambda is provided with api endpoint
    _lambda.addEnvironment(API_ENDPOINT_ENV, endpoint);

    // Add unique solution secret id to be resolved during runtime of lambda to bypass IPSet WAF for intenral calls.
    _lambda.addEnvironment(API_WAF_ALLOW_RULE_SECRET_ENV, this.secret.secretArn);

    if (ENV_DEVELOPMENT && process.env.SOLUTION_DEBUG_API_LAMBDAS) {
      // Security warning! Do not use this in production as it leaks signature and sensitive data.
      // Useful for testing auth in lambda for development.
      _lambda.addEnvironment('NODE_DEBUG', 'http,https,tls');
    }

    // Grant the lambda read access on the waf secret
    // We can't use `secret.grantRead()` as it requires kms key and this is not sensitive secret
    iam.Grant.addToPrincipalOrResource({
      grantee: _lambda,
      actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
      resourceArns: [this.secret.secretArn],
      resource: this.secret,
    });
  }

  readonly layer: lambda.ILayerVersion;

  readonly secret: DeploymentSecret;

  private constructor(scope: Stack) {
    super(scope, SINGLETON_UUID);

    this.layer = new lambda.LayerVersion(scope, 'Layer', {
      description: 'Api layer modules - provides @ada/api-client',
      code: lambda.Code.fromAsset(CODE_DIR), // make sure to zip folder containing "nodejs" directory
      compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
    });

    this.secret = new DeploymentSecret(scope, 'ApiWafDeploymentSecret', {
      description: 'Secret used to enable internal calls to bypass IPSet rule in WAF.',
      removalPolicy: RemovalPolicy.DESTROY,
    });

    addCfnNagSuppressions(this.secret.node.defaultChild as CfnResource, [
      {
        id: 'W77',
        reason: 'The secret is not considered highly sensitive as they just identity unique deployment',
      },
    ]);
  }
}
