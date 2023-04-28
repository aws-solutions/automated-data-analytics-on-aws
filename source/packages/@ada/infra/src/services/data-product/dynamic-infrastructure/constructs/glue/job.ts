/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { CfnJob } from 'aws-cdk-lib/aws-glue';
import { Construct } from 'constructs';
import { ExternalFacingRole } from '../../../../../common/constructs/iam/external-facing-role';
import { Grant, IGrantable, IPrincipal } from 'aws-cdk-lib/aws-iam';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { Stack } from 'aws-cdk-lib';
import { DataProductTransform as Transform } from '@ada/api';
import { getScriptS3Path, getTransformWrapperScriptS3Key } from '@ada/microservice-common';

export interface JobProps {
  readonly name: string;
  readonly transform: Transform;
  readonly scriptBucket: IBucket;
  readonly glueSecurityConfigurationName: string;
  readonly sourceAccessRole: ExternalFacingRole;
  readonly glueConnectionNames?: string[];
  readonly extraJobArgs?: { [key: string]: string };
}

/**
 * Construct for a glue job
 */
export default class Job extends Construct implements IGrantable {
  public readonly job: CfnJob;
  public readonly grantPrincipal: IPrincipal;

  constructor(
    scope: Construct,
    id: string,
    {
      name,
      scriptBucket,
      transform,
      glueSecurityConfigurationName,
      sourceAccessRole,
      glueConnectionNames,
      extraJobArgs,
    }: JobProps,
  ) {
    super(scope, id);

    this.job = new CfnJob(this, 'Job', {
      name,
      command: {
        name: 'glueetl',
        pythonVersion: '3',
        scriptLocation: getTransformWrapperScriptS3Key(scriptBucket.bucketName),
      },
      defaultArguments: {
        '--extra-py-files': getScriptS3Path(scriptBucket.bucketName, transform),
        '--INPUT_ARGS': transform.inputArgs ? JSON.stringify(transform.inputArgs) : '{}',
        '--additional-python-modules': 'awswrangler',
        ...extraJobArgs,
      },
      glueVersion: '3.0',
      role: sourceAccessRole.roleArn,
      executionProperty: {
        // This is the maximum supported by glue
        maxConcurrentRuns: 1000,
      },
      securityConfiguration: glueSecurityConfigurationName,
      connections:
        glueConnectionNames && glueConnectionNames.length > 0 ? { connections: glueConnectionNames } : undefined,
    });
  }

  public grantExecuteJob = (identity: IGrantable) => {
    return Grant.addToPrincipal({
      grantee: identity,
      actions: ['glue:StartJobRun', 'glue:GetJobRun', 'glue:GetJobRuns', 'glue:BatchStopJobRun'],
      resourceArns: [
        Stack.of(this).formatArn({
          service: 'glue',
          resource: 'job',
          resourceName: this.job.name,
        }),
      ],
    });
  };
}
