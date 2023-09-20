/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as cxapi from '@aws-cdk/cx-api';
import { ApiClient } from '@ada/api-client-lambda';
import { App } from 'aws-cdk-lib';
import { AssetBuildNode, AssetPublishNode, StackNode } from 'aws-cdk/lib/util/work-graph-types';
import { AwsCloudFormationInstance, AwsSSMInstance, CloudFormation } from '@ada/aws-sdk';
import { CallingUser, DATA_PRODUCT_CLOUD_FORMATION_STACK_NAME_PREFIX } from '@ada/common';
import { Concurrency } from 'aws-cdk/lib/util/work-graph';
import { DataProduct } from '@ada/api';
import { Deployments } from 'aws-cdk/lib/api/deployments';
import { SdkProvider } from 'aws-cdk/lib/api/aws-auth';
import { WorkGraphBuilder } from 'aws-cdk/lib/util/work-graph-builder';

import { StaticInfra } from '@ada/infra-common/services';
import { VError } from 'verror';
import { getFriendlyHash } from '@ada/cdk-core';
import { synthesizeConnectorStack } from './synthesizers';
import { v4 as uuid } from 'uuid';

const cfn = AwsCloudFormationInstance();

const DATA_PRODUCT_STATIC_INFRASTRUCTURE_PARAMETER_NAME =
  process.env.DATA_PRODUCT_STATIC_INFRASTRUCTURE_PARAMETER_NAME ?? '';

const ssm = AwsSSMInstance();

export const getStaticInfrastructureDetails = async (): Promise<StaticInfra.IStaticParams> =>
  JSON.parse(
    (
      await ssm
        .getParameter({
          Name: DATA_PRODUCT_STATIC_INFRASTRUCTURE_PARAMETER_NAME,
        })
        .promise()
    ).Parameter!.Value!,
  );

/**
 * Create the infrastructure for the given data product as a cdk stack
 * @param stackIdentifier an identifier for the stack
 * @param dataProduct the data product to create infrastructure for
 */
const createDataProductInfraStack = async (
  stackIdentifier: string,
  dataProduct: DataProduct,
  api: ApiClient,
  callingUser: CallingUser,
): Promise<App> => {
  const app = new App({ outdir: `/tmp/${stackIdentifier}` });
  await synthesizeConnectorStack({
    app,
    api,
    stackIdentifier,
    dataProduct,
    callingUser,
    staticInfrastructure: await getStaticInfrastructureDetails(),
  });
  return app;
};

/**
 * Synthesize and start the deployment of a data product's dynamic infrastructure
 * @param dataProduct the data product to deploy the dynamic infrastructure for
 * @param callingUser the user creating the data product
 */
export const startDataProductInfraDeployment = async (
  dataProduct: DataProduct,
  callingUser: CallingUser,
): Promise<string> => {
  // Stack identifier contains a unique id so that it is different if a data product is deleted and recreated with the
  // same domainId and dataProductId
  const stackIdentifier = `${DATA_PRODUCT_CLOUD_FORMATION_STACK_NAME_PREFIX}${getFriendlyHash(
    dataProduct.domainId,
  )}-${getFriendlyHash(dataProduct.dataProductId)}-${uuid().substring(0, 4)}`.replace(/_/g, '-');

  const api = ApiClient.create(callingUser);
  const app = await createDataProductInfraStack(stackIdentifier, dataProduct, api, callingUser);

  const stack = app.synth().getStackByName(stackIdentifier);

  let dynamicStackArn = '';
  console.log('Synthesized dynamic infrastructure stack', stackIdentifier, stack);

  const sdkProvider = await SdkProvider.withAwsCliCompatibleDefaults();
  const deployments = new Deployments({ sdkProvider });

  const buildAsset = async (assetNode: AssetBuildNode) => {
    await deployments.buildSingleAsset(assetNode.assetManifestArtifact, assetNode.assetManifest, assetNode.asset, {
      stack: assetNode.parentStack,
      stackName: assetNode.parentStack.stackName,
    });
  };

  const publishAsset = async (assetNode: AssetPublishNode) => {
    await deployments.publishSingleAsset(assetNode.assetManifest, assetNode.asset, {
      stack: assetNode.parentStack,
      stackName: assetNode.parentStack.stackName,
    });
  };

  const deployStack = async (assetNode: StackNode) => {
    const stack = assetNode.stack;
    // Prepare for deployment - uploads assets and creates the change set, ready to deploy
    const { stackArn } = await deployments.deployStack({
      // @ts-ignore: https://github.com/aws/aws-cdk/issues/18211
      stack,
      tags: Object.keys(stack.tags)
        .map((Key) => {
          return { Key, Value: stack.tags[Key] };
        })
        .concat([
          {
            Key: 'DataProductId',
            Value: dataProduct.dataProductId,
          },
          {
            Key: 'DomainId',
            Value: dataProduct.domainId,
          },
        ]),
      // Do not execute the deployment via cdk since it waits for the deployment to complete
      execute: false,
    });

    // Find the change set that was created since the cdk deployStack does not return it
    const changeSets = await cfn
      .listChangeSets({
        StackName: stackArn,
      })
      .promise();

    // We expect a single change set for the data product
    if (changeSets?.Summaries?.length !== 1) {
      throw new VError(
        { name: 'SingleChangeSetError' },
        `Expected a single change set to deploy dynamic infrastructure: ${JSON.stringify(changeSets)}`,
      );
    }

    const changeSetId = changeSets.Summaries[0].ChangeSetId!;

    console.log('Deploying dynamic data product infrastructure with change set id:', changeSetId);

    await cfn
      .executeChangeSet({
        ChangeSetName: changeSetId,
        StackName: stackArn,
      })
      .promise();

    dynamicStackArn = stackArn;
  };

  try {
    console.log('Prepare assets');
    const stackAndAssetManifests = [
      <unknown>stack as cxapi.CloudFormationStackArtifact,
      ...(<unknown>(
        stack.dependencies?.filter(cxapi.AssetManifestArtifact.isAssetManifestArtifact) ?? []
      ) as cxapi.CloudArtifact[]),
    ];

    const workGraph = new WorkGraphBuilder(false).build(stackAndAssetManifests);
    const graphConcurrency: Concurrency = {
      stack: 1,
      'asset-build': 1, // This will be CPU-bound/memory bound, mostly matters for Docker builds
      'asset-publish': 1, // This will be I/O-bound, 8 in parallel seems reasonable
    };

    console.log('Start building, publishing and deployment');
    await workGraph.doParallel(graphConcurrency, {
      deployStack,
      buildAsset,
      publishAsset,
    });
  } catch (e) {
    console.log(`Dynamic infrastructure stack ${stackIdentifier} failed to deploy.`);
    throw e;
  }

  return dynamicStackArn;
};

/**
 * Describe the cloudformation stack with the given id. Throws an error if it does not exist.
 * @param cloudFormationStackId the id of the cloudformation stack to describe
 */
export const describeStack = async (cloudFormationStackId: string): Promise<CloudFormation.Stack> => {
  const response = await cfn
    .describeStacks({
      StackName: cloudFormationStackId,
    })
    .promise();

  if (response.Stacks?.length !== 1) {
    throw new VError({ name: 'CfnStackNotFoundError' }, `No stack found with id ${cloudFormationStackId}`);
  }
  return response.Stacks[0];
};

/**
 * Return whether or not the stack is in a terminal status
 * @param stack the cloudformation stack to check
 */
export const isTerminalStatus = (stack: CloudFormation.Stack): boolean => !stack.StackStatus.endsWith('IN_PROGRESS');
