/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { JavaFunction } from '@ada/infra-common';
import { Key } from 'aws-cdk-lib/aws-kms';
import { LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { MicroserviceApi, MicroserviceApiProps } from '../../../common/services';
import { Query } from '../../query/api/types/query';
import {
  QueryDiscoverOutput,
  QueryRewriteInput,
  ValidateAttributeValuePolicyInput,
  ValidateAttributeValuePolicyOutput,
} from './types';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Role } from 'aws-cdk-lib/aws-iam';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StatusCodes } from 'http-status-codes/build/cjs';
import { getUniqueKmsKeyAlias } from '@ada/cdk-core';

const PACKAGE_QPRL = 'query-parse-render-lambdas';

export interface QueryParseRenderApiProps extends MicroserviceApiProps {
  executeAthenaQueryLambdaRoleArn: string;
}

export default class QueryParseRenderApi extends MicroserviceApi {
  readonly discoverLambda: JavaFunction;
  readonly rewriteLambda: JavaFunction;
  readonly athenaLensLambda: JavaFunction;
  readonly validateAttributeValuePolicyLambda: JavaFunction;

  constructor(scope: Construct, id: string, props: QueryParseRenderApiProps) {
    super(scope, id, props);

    const key = new Key(this, 'KmsSaltKey', {
      enableKeyRotation: true,
      alias: getUniqueKmsKeyAlias(this, 'lens-salt'),
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const secretSalt = new Secret(this, 'SecretSalt', { encryptionKey: key });

    this.athenaLensLambda = new JavaFunction(this, 'GovernanceAthenaLensLambda', {
      package: 'athena-lens',
      handler: 'com.ada.query.parserender.lens.AthenaLensHandler',
      alias: 'prod',
      environmentVariables: {
        SALT_ARN: secretSalt.secretFullArn!,
      },
    });
    key.grantDecrypt(this.athenaLensLambda);
    secretSalt.grantRead(this.athenaLensLambda);

    this.athenaLensLambda.alias.grantInvoke(
      Role.fromRoleArn(this, 'QueryExecuteRole', props.executeAthenaQueryLambdaRoleArn),
    );

    this.discoverLambda = new JavaFunction(this, 'QueryParseRenderDiscoverLambda', {
      package: PACKAGE_QPRL,
      handler: 'com.ada.query.parserender.handlers.DiscoverHandler',
      alias: 'prod',
    });

    this.rewriteLambda = new JavaFunction(this, 'QueryParseRenderRewriteLambda', {
      package: PACKAGE_QPRL,
      handler: 'com.ada.query.parserender.handlers.RewriteHandler',
      alias: 'prod',
      environmentVariables: {
        ATHENA_LENS_LAMBDA: this.athenaLensLambda.alias.functionName,
      },
    });

    this.validateAttributeValuePolicyLambda = new JavaFunction(this, 'ValidateAttributePolicyLambda', {
      package: PACKAGE_QPRL,
      handler: 'com.ada.query.parserender.handlers.ValidateAttributePolicyHandler',
      alias: 'prod',
    });

    this.addRoutes();
  }

  private addRoutes() {
    this.api.addRoutes({
      paths: {
        // /query-parse-render/discover
        '/discover': {
          // POST /query-parse-render/discover
          POST: {
            integration: new LambdaIntegration(this.discoverLambda.alias),
            request: {
              name: 'DiscoverInput',
              description: 'The query for which to discover involved data products',
              schema: Query,
            },
            response: {
              name: 'DiscoverOutput',
              description: 'The data products discovered from the query',
              schema: QueryDiscoverOutput,
              errorStatusCodes: [StatusCodes.BAD_REQUEST],
            },
          },
        },
        // /query-parse-render/rewrite
        '/rewrite': {
          POST: {
            integration: new LambdaIntegration(this.rewriteLambda.alias),
            request: {
              name: 'RewriteInput',
              description: 'The input required to rewrite a query with governance applied',
              schema: QueryRewriteInput,
            },
            response: {
              name: 'RewriteOutput',
              description: 'A query ready to execute in Athena',
              schema: Query,
              errorStatusCodes: [StatusCodes.BAD_REQUEST],
            },
          },
        },
        '/validate-attribute-value-policy': {
          // POST /query-parse-render/validate-attribute-value-policy
          POST: {
            integration: new LambdaIntegration(this.validateAttributeValuePolicyLambda.alias),
            request: {
              name: 'ValidateAttributePolicyInput',
              description: 'The attribute value policy to validate',
              schema: ValidateAttributeValuePolicyInput,
            },
            response: {
              name: 'ValidateAttributePolicyOutput',
              description: 'An empty response if validation is successful',
              schema: ValidateAttributeValuePolicyOutput,
              errorStatusCodes: [StatusCodes.BAD_REQUEST],
            },
          },
        },
      },
    });
  }
}
