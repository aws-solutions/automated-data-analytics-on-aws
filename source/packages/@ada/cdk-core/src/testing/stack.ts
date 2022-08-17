/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as iam from 'aws-cdk-lib/aws-iam';
import { App, AppProps, Environment, StackProps } from 'aws-cdk-lib';
import {
  BUNDLING_STACKS,
  DISABLE_ASSET_STAGING_CONTEXT,
} from 'aws-cdk-lib/cx-api';
import { Construct } from 'constructs';
import { ExtendedStack } from '../extended-stack';
import { merge } from 'lodash';

export const TEST_STACK_ID = 'TestStack';

export const TEST_ACCOUNT = '1111111111';

export const TEST_REGION = 'ap-southeast-1';

export const TEST_ENVIRONMENT: Environment = {
  account: TEST_ACCOUNT,
  region: TEST_REGION,
};

const BASE_TEST_CONTEXT = {
  adminEmail: 'test@example.com',
  adminPhoneNumber: '+1234567890',
  adminMFA: 'ON',
};

export const DISABLE_BUNDLING_CONTEXT = {
  [BUNDLING_STACKS]: [],
  [DISABLE_ASSET_STAGING_CONTEXT]: true,
};

export const TEST_CONTEXT = {
  ...BASE_TEST_CONTEXT,
  ...DISABLE_BUNDLING_CONTEXT,
};

/**
 * CDK App with testing context applied
 * - prevents bundling
 */
export class TestApp extends App {
  constructor(props?: AppProps) {
    super(
      merge(
        {
          context: TEST_CONTEXT,
        },
        props,
      ),
    );
  }
}

/**
 * CDK Stack for testing that supports disabling bundling and defaults id
 */
export interface TestStackProps extends StackProps {
  /**
   * Enables bundling for the test stack.
   * @default true
   */
  enableBundling?: boolean;
}

export class TestStack extends ExtendedStack {
  constructor(scope?: Construct, id?: string, props?: TestStackProps) {
    super(
      scope,
      id || TEST_STACK_ID,
      merge(
        {
          env: TEST_ENVIRONMENT,
        },
        props,
      ),
    );

    Object.keys(BASE_TEST_CONTEXT).forEach((contextKey) => {
      this.node.setContext(contextKey, BASE_TEST_CONTEXT[contextKey as keyof typeof BASE_TEST_CONTEXT]);
    });

    if (props?.enableBundling !== false) {
      // https://github.com/aws/aws-cdk/issues/12844#issuecomment-775274294
      this.node.setContext(BUNDLING_STACKS, []);
      this.node.setContext(DISABLE_ASSET_STAGING_CONTEXT, true);
    }
  }
}

export class TestStackWithResource extends TestStack {
  constructor(scope?: Construct, id?: string, props?: TestStackProps) {
    super(scope, id, props);

    new iam.Role(this, 'TestRole', {
      assumedBy: new iam.AnyPrincipal(),
      description: 'Need at least one resource for stack so this is mock role.',
    });
  }
}
