/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as cr from 'aws-cdk-lib/custom-resources';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Construct } from 'constructs';
import { CustomResource, Lazy, Stack } from 'aws-cdk-lib';
import { Data, Properties } from './common';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { getRootStack } from '../../utils';

const UUID = 'NamespaceGlobalUUID';
const LAMBDA_ID = `${UUID}Lambda`;
const GLOBALHASH_PROP = Symbol('@GLOBALHASH');

export const TEST_GLOBAL_HASH = 'ghashx'; // 6 digit lower alphanum

// prevent require.resolve error in infra build
function getHandlerFile(): string {
  const baseFilePath = path.join(__dirname, 'handler');
  if (fs.pathExistsSync(baseFilePath + '.js')) {
    return baseFilePath + '.js';
  }
  if (fs.pathExistsSync(baseFilePath + '.ts')) {
    return baseFilePath + '.ts';
  }
  throw new Error('Failed to find handler');
}

export class NamespaceGlobalUUID extends Construct {
  /**
   * Gets the `NamespaceGlobalUUID` instance of the root stack.
   * @param construct
   * @returns
   */
  private static of(scope: Construct): NamespaceGlobalUUID | undefined {
    const rootStack = getRootStack(scope);

    return rootStack.node.tryFindChild(UUID) as NamespaceGlobalUUID | undefined;
  }

  private static tryFindGlobalHash(scope: Construct): string | undefined {
    // short-circuit for testing to resolve to literal
    if (process.env.NODE_ENV === 'test') {
      return TEST_GLOBAL_HASH;
    }

    const instance = NamespaceGlobalUUID.of(scope);
    if (instance) {
      return instance.uuid;
    }

    // Dynamic infra is root Stack, but uses params to propagate via `storeGlobalHash`
    const rootStack = getRootStack(scope);
    return (rootStack as any)[GLOBALHASH_PROP];
  }

  static globalHash(scope: Construct): string {
    const globalHash = NamespaceGlobalUUID.tryFindGlobalHash(scope);

    if (globalHash) {
      return globalHash;
    }

    // return lazy to resolve it during synth time
    return Lazy.string({
      produce(): string {
        const lazyHash = NamespaceGlobalUUID.tryFindGlobalHash(scope);
        if (lazyHash == null) {
          throw new Error(`Failed to resolve globalHash: ${scope.node.path}`);
        }
        return lazyHash;
      },
    });
  }

  /**
   * Stores the global hash resolvable token string value to the root stack
   * for retrieval.
   * @param rootStack
   * @param globalHash
   */
  static storeGlobalHash(rootStack: Stack, globalHash: string): void {
    Object.defineProperty(rootStack, GLOBALHASH_PROP, {
      get() {
        return globalHash;
      },
      // ensure we can check via `prop in` syntax
      enumerable: true,
    });
  }

  readonly uuid: string;

  constructor(scope: Stack) {
    const rootStack = getRootStack(scope);
    if (scope !== rootStack) {
      throw new Error(`${UUID} scope must be the root stack`);
    }
    super(scope, UUID);

    const lambda = new NodejsFunction(this, LAMBDA_ID, {
      entry: getHandlerFile(),
      handler: 'handler',
      description: 'Cloudformation deployment helper generated unique short uuid',
    });

    const provider = new cr.Provider(this, 'Provider', {
      onEventHandler: lambda,
    });

    const customResource = new CustomResource(this, 'CustomResource', {
      serviceToken: provider.serviceToken,
      properties: {} as Properties,
    });

    this.uuid = customResource.getAttString('uuid' as keyof Data);
  }
}
