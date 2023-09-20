/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { DynamicInfraStackProps } from '@ada/dynamic-infra/stacks/dynamic-infrastructure-stack-base';
import { IStateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { Rule } from 'aws-cdk-lib/aws-events';
import { S3SourceStack } from '../../../amazon_s3/infra/dynamic/stack';

/**
 * Stack for a data product from file upload
 */
export class FileUploadSourceTask extends S3SourceStack {
  constructor(scope: Construct, id: string, props: DynamicInfraStackProps) {
    super(scope, id, props);
  }

  protected getDefaultTransformRequired(): boolean {
    return false;
  }

  protected createDataSourceInfrastructureAndStateMachine(props: DynamicInfraStackProps): IStateMachine {
    return super.createDataSourceInfrastructureAndStateMachine(props);
  }

  protected createAutomaticDataUpdateTriggerRule(props: DynamicInfraStackProps): Rule {
    return super.createAutomaticDataUpdateTriggerRule(props);
  }
}

export default FileUploadSourceTask;
