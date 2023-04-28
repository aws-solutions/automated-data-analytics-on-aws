/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as path from 'path';
import { Alias, Code, Function, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { AssetHashType, BundlingOutput, Duration, FileSystem } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SolutionContext, tryGetSolutionContext } from '../../context';
import { getPackagePath } from '../../utils/assets';
import { pascalCase } from '@ada/cdk-core';
import { uniqueLambdaDescription } from './utils';

export interface JavaFunctionProps {
  readonly package: string;
  readonly handler: string;
  readonly environmentVariables?: {
    [key: string]: string;
  };
  readonly alias?: string;
  readonly provisionedConcurrentExecutions?: number;
  readonly description?: string;
}

export class JavaFunction extends Function {
  public readonly alias: Alias;

  constructor(scope: Construct, id: string, props: JavaFunctionProps) {
    // most ids include filenames which result in cryptic logicalIds, so we force all to PascalCase for
    // readability of the resulting lambda function name
    id = pascalCase(id);

    const packagePath = getPackagePath(props.package);

    // For java lambdas, we hash the src directory and pom.xml to ensure ide-generated files/outputs etc are not
    // taken into account when calculating the hash
    const assetHash = FileSystem.fingerprint(path.join(packagePath, 'src'), {
      extraHash: FileSystem.fingerprint(path.join(packagePath, 'pom.xml')),
    });

    // use `assetHash` in description to force lambda function update on version change
    const description = (props.description || `Java function for ${props.package}`) + ` (${id}:${assetHash})`;

    super(scope, id, {
      runtime: Runtime.JAVA_11,
      code: Code.fromAsset(getPackagePath(props.package), {
        assetHashType: AssetHashType.CUSTOM,
        assetHash,
        bundling: {
          command: ['/bin/sh', '-c', `mvn clean install && cp /asset-input/target/${props.package}.jar /asset-output/`],
          image: Runtime.JAVA_11.bundlingImage,
          volumes: [
            {
              hostPath: `${process.env.HOME}/.m2/`,
              containerPath: '/root/.m2/',
            },
          ],
          user: 'root',
          outputType: BundlingOutput.ARCHIVED,
        },
      }),
      environment: props.environmentVariables,
      handler: props.handler,
      timeout: Duration.seconds(60),
      memorySize: 1024,
      tracing: Tracing.ACTIVE,
      // When alias is defined we need to force new version by generating unique description
      // https://github.com/aws/aws-cdk/issues/5334#issuecomment-562981777
      description: props.alias ? uniqueLambdaDescription(description) : description,
    });

    if (props.alias) {
      let provisionedConcurrentExecutions = props.provisionedConcurrentExecutions;
      if (provisionedConcurrentExecutions == null) {
        provisionedConcurrentExecutions = tryGetSolutionContext(
          this,
          SolutionContext.JAVA_LAMBDA_PROVISIONED_CONCURRENT_EXECUTIONS,
        );
        provisionedConcurrentExecutions =
          (provisionedConcurrentExecutions || 0) >= 1 ? provisionedConcurrentExecutions : undefined;
      }
      this.alias = this.addAlias(props.alias, {
        provisionedConcurrentExecutions,
      });
    }
  }
}
