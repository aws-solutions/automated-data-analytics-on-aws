/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fs from 'fs-extra';
import { App, NestedStack, Stack, Token } from 'aws-cdk-lib';
import { AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { Bucket } from '../../../constructs/s3/bucket';
import { BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Code, EnvironmentOptions, IFunction, Function as LambdaFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { CounterTable } from '../../../constructs/dynamodb/counter-table';
import { DynamoDB } from 'aws-sdk';
import { FederatedRestApi } from '../../../constructs/api';
import { IdentitySource, RequestAuthorizer } from 'aws-cdk-lib/aws-apigateway';
import { Microservice, MicroserviceProps } from '../..';
import { NotificationBus } from '../../../../services/api/components/notification/constructs/bus';
import { Template } from 'aws-cdk-lib/assertions';
import { TestApp, TestStack, getRootStack } from '@ada/cdk-core';
import { omit, uniqBy } from 'lodash';
import findFreePort from 'find-port-free-sync';

// Port to run dynamodb local on - find available port within range
const DYNAMODB_LOCAL_PORT = findFreePort({
  start: 8700,
  end: 8799,
});

const UNSUPPORTED_DDB_PROPRTIES = ['PointInTimeRecoverySpecification', 'SSESpecification'];

export function getCdkEnvironmentForTests(stackUnderTest: Stack, additionalTables?: DynamoDB.CreateTableInput[]) {
  const synthedApp = synthTestApp(stackUnderTest);

  const tables = buildAppDynamoTables(synthedApp).concat(additionalTables || []);
  const environmentVariables = buildAppLambdaEnvironmentVariables(synthedApp);

  return {
    tables,
    environmentVariables,
  };
}

/**
 * Find dynamodb tables defined in the given cloudformation template
 * @param cfn cloudformation template
 */
export const findDynamoTables = (cfn: any): DynamoDB.CreateTableInput[] =>
  Object.keys(cfn.Resources || {})
    .filter((refId) => cfn.Resources[refId].Type === 'AWS::DynamoDB::Table')
    .map((refId) => ({
      ...(omit(cfn.Resources[refId].Properties, UNSUPPORTED_DDB_PROPRTIES) as any),
      TableName: refId,
    }));

export function buildAppDynamoTables(
  synthedApp: SynthedApp,
  additionalTables?: DynamoDB.CreateTableInput[],
): DynamoDB.CreateTableInput[] {
  return uniqBy(
    (additionalTables || []).concat(synthedApp.allStacks.flatMap((stack) => findDynamoTables(stack.__cloudFormation))),
    'TableName',
  );
}

export function findLambdaEnvironmentVariables(synthedApp: SynthedApp): Record<string, string | { Ref: string }> {
  const lambdas: LambdaFunction[] = synthedApp.app.node
    .findAll()
    .filter((child) => child instanceof LambdaFunction) as LambdaFunction[];

  return Object.fromEntries(
    lambdas.flatMap((lambda) => {
      // @ts-ignore: access private
      const environment: Record<string, { value: string } & EnvironmentOptions> = lambda.environment;
      return Object.entries(environment).map(([key, variable]) => {
        let value = variable.value;
        if (Token.isUnresolved(value)) {
          value = lambda.stack.resolve(value);
        }
        return [key, value];
      });
    }),
  );
}

export function resolveLambdaEnvironmentVariables(
  synthedApp: SynthedApp,
  environmentVariables: Record<string, string | { Ref: string }>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(environmentVariables).map(([key, value]) => {
      if (typeof value === 'string' || value.Ref == null) return [key, value];
      return [key, resolveSynthedAppReference(value.Ref, synthedApp)];
    }),
  ) as Record<string, string>;
}

export function buildAppLambdaEnvironmentVariables(synthedApp: SynthedApp): Record<string, string> {
  return resolveLambdaEnvironmentVariables(synthedApp, findLambdaEnvironmentVariables(synthedApp));
}

interface SynthedStack extends Stack {
  __cloudFormation: any;
  __nestedStacks: SynthedStack[];
}

function synthStack(stack: Stack): SynthedStack {
  return Object.assign(stack, {
    __cloudFormation: Template.fromStack(stack).toJSON(),
    __nestedStacks: stack.node
      .findAll()
      .filter((child) => child instanceof NestedStack && child.nestedStackParent === stack)
      .flatMap((nestedStack) => synthStack(nestedStack as NestedStack)),
  });
}

interface SynthedApp {
  app: App;
  stackUnderTest: SynthedStack;
  rootStacks: SynthedStack[];
  allStacks: SynthedStack[];
  parentStacks: SynthedStack[];
}

export function synthTestApp(stackUnderTest: Stack): SynthedApp {
  const app = getRootStack(stackUnderTest).node.scope as App;
  if (app == null) throw new Error(`synthTestApp only supports testing a stack from within an app`);

  const rootStacks = app.node
    .findAll()
    .filter((child) => child instanceof Stack && child.nested === false)
    .map((child) => synthStack(child as Stack));

  function flattenStacks(stack: SynthedStack): SynthedStack[] {
    return [stack, ...stack.__nestedStacks, ...stack.__nestedStacks.flatMap(flattenStacks)];
  }
  const allStacks = rootStacks.flatMap(flattenStacks);
  const parentStacks = allStacks.filter((stack) => stack.__nestedStacks.length > 0);

  return {
    app,
    stackUnderTest: stackUnderTest as SynthedStack,
    rootStacks,
    allStacks,
    parentStacks,
  };
}

export type NestedStackConstructor<T> = new (scope: Construct, id: string, props?: any) => T;

export interface CdkEnvironmentForTests {
  readonly tables: DynamoDB.CreateTableInput[];
  readonly environmentVariables: { [key: string]: string };
  readonly port: number;
  readonly serviceNestedStack: NestedStack;
  readonly installerConfig: {
    downloadUrl: string;
  },
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface MicroserviceType<T, P> extends LambdaFunction {
  new (scope: Construct, id: string, props: P): T;
}

type TMockableMicroserviceProps<P extends Partial<MicroserviceProps>> = Omit<
  P,
  'federatedApi' | 'notificationBus' | 'counterTable'
> &
  Partial<Pick<P, 'federatedApi' | 'notificationBus' | 'counterTable'>>;

/**
 * Builds an environment for testing based on the given nested stack for a service
 * @param ServiceNestedStack service cdk nested stack
 * @param props properties to instantiate the stack if required
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const buildCdkEnvironmentForTests = <T extends Microservice, P extends MicroserviceProps>(
  // TODO: to revert "any", without this trigger build error messages that prevent build/deployment
  ServiceNestedStack: any, // MicroserviceType<T, P>,
  props: TMockableMicroserviceProps<P>,
  stack?: Stack,
  additionalTables: any[] = [],
): CdkEnvironmentForTests => {
  try {
    if (stack == null) {
      stack = new TestStack(new TestApp());
    }

    const federatedApi = props.federatedApi
      ? props.federatedApi
      : new FederatedRestApi(stack, 'MockFederatedApi', {
          customAuthorizer: new RequestAuthorizer(stack, 'auth', {
            handler: new LambdaFunction(stack, 'MyFunction', {
              runtime: Runtime.NODEJS_16_X,
              handler: 'index.handler',
              code: Code.fromInline('console.log(1)'),
            }) as IFunction,
            identitySources: [IdentitySource.header('Authorization')],
          }),
          accessLogsBucket: new Bucket(stack, 'logsBucket', {
            // SSE-S3 is the only supported default bucket encryption for Server Access Logging target buckets
            encryption: BucketEncryption.S3_MANAGED,
          }),
        });
    const serviceNestedStack: NestedStack = new ServiceNestedStack(stack, 'Stack', {
      ...props,
      federatedApi,
      notificationBus: props.notificationBus || new NotificationBus(stack, 'NotificationBus'),
      counterTable:
        props.counterTable ||
        new CounterTable(stack, 'CounterTblMock', {
          partitionKey: {
            name: 'tableName',
            type: AttributeType.STRING,
          },
        }),
    } as P);

    return {
      ...getCdkEnvironmentForTests(serviceNestedStack, additionalTables),
      port: DYNAMODB_LOCAL_PORT,
      serviceNestedStack,
      // Fix the version due to an issue in dynamodb local: https://github.com/shelfio/jest-dynamodb/issues/212
      installerConfig: {
        downloadUrl:
          "https://s3.eu-central-1.amazonaws.com/dynamodb-local-frankfurt/dynamodb_local_2023-06-09.tar.gz",
      },
    };
  } catch (error) {
    console.error('Failed to synthesize testing environment -', error);
    throw error;
  }
};

function resolvePeerStackOutput(matchingParameter: any, cfns: any[]): any {
  const peerStackOutputs = cfns
    .map((cfn) => cfn.Outputs || {})
    .reduce(
      (allOutputs, newOutputs) => ({
        ...allOutputs,
        ...newOutputs,
      }),
      {},
    );
  if ('Fn::GetAtt' in matchingParameter && matchingParameter['Fn::GetAtt'][1].startsWith('Outputs.')) {
    const ref = matchingParameter['Fn::GetAtt'][1].split('.')[1];
    if (ref in peerStackOutputs) {
      return peerStackOutputs[ref].Value.Ref;
    }
  }
  return undefined;
}

function resolveSynthedReference(ref: string, parentStack: SynthedStack): string | undefined {
  const cfns: any[] = parentStack.__nestedStacks.map((stack) => stack.__cloudFormation);
  return resolveReference(ref, cfns, parentStack.__cloudFormation);
}

function resolveSynthedAppReference(ref: string, synthedApp: SynthedApp): string {
  const MAX_CYCLES = 4;
  let cycles = 0;
  for (let i = 0; i < synthedApp.parentStacks.length; i++) {
    const parentStack = synthedApp.parentStacks[i];
    const resolvedRef = resolveSynthedReference(ref, parentStack);
    if (resolvedRef) {
      if (resolvedRef.startsWith('referenceto') && !resolvedRef.endsWith('Arn') && cycles < MAX_CYCLES) {
        ref = resolvedRef;
        i = 0;
        cycles++;
        continue;
      }
      return resolvedRef;
    }
  }

  console.warn(
    `[WARNING] (${synthedApp.stackUnderTest.node.id}) Failed to resolve ref: ${ref} - safe to ignore unless testing scope requires this ref`,
  );

  return ref;
}

function resolveReference(ref: string, cfns: any[], parentCfn: any): any {
  const parameters = cfns
    .map((cfn) => cfn.Parameters || {})
    .reduce(
      (allParams, newParams) => ({
        ...allParams,
        ...newParams,
      }),
      {},
    );
  if (ref in parameters) {
    const nestedStackRef = Object.keys(parentCfn.Resources)
      .filter((refId) => parentCfn.Resources[refId]?.Type === 'AWS::CloudFormation::Stack')
      .filter((refId) => parentCfn.Resources[refId].Properties?.Parameters)
      .find((refId) => ref in (parentCfn.Resources[refId].Properties?.Parameters || {}));
    const matchingParameter = parentCfn.Resources[nestedStackRef!].Properties.Parameters[ref];

    return matchingParameter.Ref || resolvePeerStackOutput(matchingParameter, cfns);
  }
  return ref;
}

export const writeCdkEnvironmentToFile = (
  { tables, port, installerConfig, environmentVariables }: CdkEnvironmentForTests,
  path: string,
) => {
  fs.writeJsonSync(path, { tables, port, environmentVariables, installerConfig }, { spaces: 2 });
};
