/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Aws, Duration, Fn, Stack } from 'aws-cdk-lib';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { Bucket } from '../../../common/constructs/s3/bucket';
import { Construct } from 'constructs';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IAM_MODIFY_BUDGET, getBudgetName } from '../constant';
import { Microservice, MicroserviceProps } from '../../../common/services';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { addCfnNagSuppressionsToRolePolicy } from '@ada/cdk-core';
import AdministrationApi from '../api';
import DataProductCreationStateMachine from '../../data-product/components/creation-state-machine';
import serviceConfig from '../service-config';

import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as path from 'path';
import * as s3_deploy from 'aws-cdk-lib/aws-s3-deployment';
import { VisualisationSolutionCodeBuildPolicyStatement } from '@ada/infra-common';

export interface AdministrationServiceStackProps extends MicroserviceProps {
  dataProductCreationStateMachine: DataProductCreationStateMachine;
  dataProductTable: Table;
  dataBuckets: Bucket[];
  coreStack: Stack;
  accessLogsBucket: Bucket;
  athenaProxyDomainName: string;
}

/**
 * Administration Service Stack
 */
export class AdministrationServiceStack extends Microservice {
  readonly api: AdministrationApi;

  constructor(scope: Construct, id: string, props: AdministrationServiceStackProps) {
    super(scope, id, { ...props, ...serviceConfig });

    // Budget
    const budgetName = getBudgetName(Stack.of(this).region);
    const budgetArn = `arn:${Stack.of(this).partition}:budgets::${Stack.of(this).account}:budget/${budgetName}`;
    const policy = AwsCustomResourcePolicy.fromStatements([
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [IAM_MODIFY_BUDGET],
        resources: [budgetArn],
      }),
    ]);

    new AwsCustomResource(this, 'BudgetCleanUp', {
      policy,
      onDelete: {
        ignoreErrorCodesMatching: 'NotFoundException',
        service: 'Budgets',
        action: 'DeleteBudget',
        parameters: {
          AccountId: Stack.of(this).account,
          BudgetName: budgetName,
        },
        physicalResourceId: PhysicalResourceId.of(budgetName),
      },
    });

    // Visualisation solution deployment code build and scripts
    const deploymentScriptBucket = new Bucket(this, 'DeploymentScriptBucket', {
      retain: false,
      serverAccessLogsBucket: props.accessLogsBucket,
      serverAccessLogsPrefix: 'deployment-scripts/',
    });

    const deployment = new s3_deploy.BucketDeployment(this, 'DeployScripts', {
      sources: [s3_deploy.Source.asset(path.resolve(__dirname, 'visualisation-deployment'))],
      destinationBucket: deploymentScriptBucket,
      extract: false,
      destinationKeyPrefix: 'deployment',
    });

    const deployProject = new codebuild.Project(this, 'VisSolutionDeployProject', {
      description: 'CodeBuild project to deploy Apache Superset visualisation solution for Ada',
      source: codebuild.Source.s3({
        bucket: deploymentScriptBucket,
        path: Fn.join('/', ['deployment', Fn.select(0, deployment.objectKeys)]),
      }),
      buildSpec: codebuild.BuildSpec.fromAsset(
        path.resolve(__dirname, 'visualisation-deployment/visualisation-deployment-spec.yml'),
      ),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
        computeType: codebuild.ComputeType.MEDIUM,
        privileged: true,
      },
      environmentVariables: {
        ADA_ATHENA_ENDPOINT_URL: { value: `https://${props.athenaProxyDomainName}` },
        AWS_REGION: { value: Aws.REGION },
        VERSION_TAG: { value: 'latest' },
        CFN_TEMP_BUCKET: { value: deploymentScriptBucket.bucketName },
      },
      timeout: Duration.hours(2),
    });
    deployProject.addToRolePolicy(VisualisationSolutionCodeBuildPolicyStatement);
    deploymentScriptBucket.grantReadWrite(deployProject);

    addCfnNagSuppressionsToRolePolicy(
      deployProject.role!,
      ['W12', 'F4', 'F39', 'W76'].map((_id) => ({
        id: _id,
        reason: 'This role requires permissions to deploy the AWS partner solution for visualisation',
      })),
    );

    // API
    this.api = new AdministrationApi(this, 'Api', {
      ...serviceConfig,
      ...props,
      visualisationDeploymentCodeBuildProjectName: deployProject.projectName,
    });
  }
}

export default AdministrationServiceStack;
