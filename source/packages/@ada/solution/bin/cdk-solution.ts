#!/usr/bin/env node
/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AdaStack } from '@ada/infra';
import { BUNDLING_STACKS, DISABLE_ASSET_STAGING_CONTEXT } from 'aws-cdk-lib/cx-api';
import { CfnNagSuppressionAspect } from '@ada/cdk-core';
import { solutionInfo } from '@ada/common';

(async () => {
  let context: cdk.AppProps['context'];

  // development flag to disable bundling to speed up testing cycles
  if (process.env.NODE_ENV !== 'production' && process.env.DISABLE_CDK_BUNDLING) {
    console.warn('CDK BUNDLING IS DISABLED');
    context = {
      [BUNDLING_STACKS]: [],
      [DISABLE_ASSET_STAGING_CONTEXT]: true,
    };
  }

  const app = new cdk.App({
    context,
  });

  // NB: No environment is passed here to ensure synthesized CDK is environment-agnostic
  const { awsSolutionId, awsSolutionVersion, title } = solutionInfo();
  new AdaStack(app, undefined, {
    description: `(${awsSolutionId}) - ${title}. Version ${awsSolutionVersion}`,
  });

  cdk.Aspects.of(app).add(new CfnNagSuppressionAspect());
})();
