/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Construct } from 'constructs';
import { IStateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { Rule } from 'aws-cdk-lib/aws-events';
import { S3SourceStack, S3SourceStackProps } from '.';

export type FileUploadSourceTaskProps = S3SourceStackProps;

/**
 * Stack for a data product from file upload
 */
export class FileUploadSourceTask extends S3SourceStack {
  constructor(scope: Construct, id: string, props: FileUploadSourceTaskProps) {
    super(scope, id, props);
  }

  protected createDataSourceInfrastructureAndStateMachine(props: FileUploadSourceTaskProps): IStateMachine {
    return super.createDataSourceInfrastructureAndStateMachine(props);
  }

  protected createAutomaticDataUpdateTriggerRule(props: FileUploadSourceTaskProps): Rule {
    return super.createAutomaticDataUpdateTriggerRule(props);
  }
}
