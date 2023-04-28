/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path';
import { Alias, Architecture, Function, ILayerVersion, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { ApiLambdaLayer } from '../api/lambda-layer';
import { Construct } from 'constructs';
import { CounterTable } from '../dynamodb/counter-table';
import { Duration } from 'aws-cdk-lib';
import { EntityManagementTables } from '../../../services/api/components/entity/constructs/entity-management-tables';
import { InternalTokenKey } from '../kms/internal-token-key';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import { NotificationBus } from '../../../services/api/components/notification/constructs/bus';
import { PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { getPackagePath } from '../../utils/assets';
import { pascalCase } from '@ada/cdk-core';
import { uniqueLambdaDescription } from './utils';

/* eslint-disable sonarjs/cognitive-complexity */

export interface SolutionIntegrationTypescriptFunctionProps {
  /**
   * When provided, grants the permissions and adds the appropriate environment variables for sending
   * notifications
   */
  readonly notificationBus?: NotificationBus;
  readonly counterTable?: CounterTable;
  readonly internalTokenKey?: InternalTokenKey;
  readonly entityManagementTables?: EntityManagementTables;
}

export interface TypescriptFunctionProps extends SolutionIntegrationTypescriptFunctionProps {
  readonly package?: string;
  readonly handlerFile: string;
  readonly handlerFunction?: string;
  readonly environment?: { [key: string]: string };
  readonly layers?: ILayerVersion[];
  readonly nodeModules?: string[];
  readonly timeout?: Duration;
  readonly role?: Role;
  readonly initialPolicy?: PolicyStatement[];
  readonly alias?: string;
  readonly description?: string;
  readonly provisionedConcurrentExecutions?: number;
  readonly memorySize?: number;
  /**
   * Defines the endpoint for the api. If provided the api-client lambda
   * layer will automatically be added and configured for this lambda function.
   */
  readonly apiLayer?: {
    endpoint: string;
  };
}

/**
 * Construct for a typescript lambda function
 * Package must have the following directory structure:
 *
 * src/
 *   |- handlers/
 *      |- <handlerFile>.ts
 *
 * Where <handlerFile>.ts exports a function named 'handler' (overidden by the handlerFunction prop).
 */
export class TypescriptFunction extends NodejsFunction {
  public static applySolutionIntegration(_lambda: Function, props: SolutionIntegrationTypescriptFunctionProps): void {
    props.notificationBus?.configureLambdaForNotifications(_lambda);
    props.counterTable?.configureLambdaForPagination(_lambda);
    props.internalTokenKey?.configureLambdaForDecrypt(_lambda);
    props.entityManagementTables?.configureLambdaForEntityManagement(_lambda);
  }

  public readonly alias: Alias;

  constructor(scope: Construct, id: string, props: TypescriptFunctionProps) { //NOSONAR (S3776:Cognitive Complexity) - won't fix
    // most ids include filenames which result in cryptic logicalIds, so we force all to PascalCase for
    // readability of the resulting lambda function name
    id = pascalCase(id);

    let entry;
    if (path.isAbsolute(props.handlerFile)) {
      entry = props.handlerFile;
    } else {
      if (props.package == null)
        throw new Error(
          'TypescriptFunction requires `props.package` to be defined when non-absolute `handlerFile` passed',
        );
      const handlerFile = props.handlerFile.endsWith('.ts') ? props.handlerFile : props.handlerFile + '.ts';
      entry = path.join(getPackagePath(props.package), 'src/handlers', handlerFile);
    }

    const description = props.description || `TypescriptFunction ${scope.node.path}/${id} of ${path.basename(entry)}`;

    let fnProps: NodejsFunctionProps = {
      entry,
      handler: props.handlerFunction || 'handler',
      timeout: props.timeout || Duration.seconds(30),
      memorySize: props.memorySize || 1024,
      runtime: Runtime.NODEJS_16_X,
      environment: props.environment,
      layers: props.layers,
      role: props.role,
      architecture: Architecture.X86_64,
      initialPolicy: props.initialPolicy,
      bundling: {
        // NOTE: Investigate why some lambdas fail with an import error without this!
        nodeModules: ['punycode'].concat(props.nodeModules || []),
      },
      tracing: Tracing.ACTIVE,
      // When alias is defined we need to force new version by generating unique description
      // https://github.com/aws/aws-cdk/issues/5334#issuecomment-562981777
      description: props.alias ? uniqueLambdaDescription(description) : description,
    };

    if (props.apiLayer?.endpoint) {
      // Augment bundling to exclude node_modules provided by the layer
      fnProps = ApiLambdaLayer.of(scope).applyToLambdaProps(fnProps);
    }

    super(scope, id, fnProps);

    if (props.apiLayer?.endpoint) {
      // Add required environment variables and the api layer to this lambda
      ApiLambdaLayer.of(this).bind(this, props.apiLayer.endpoint);
    }

    TypescriptFunction.applySolutionIntegration(this, props);

    if (props.alias) {
      this.alias = this.addAlias(props.alias, {
        provisionedConcurrentExecutions: props.provisionedConcurrentExecutions,
      });
    }
  }
}
