/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { FileUploadSourceTask } from '../../stacks';
import { Stack } from 'aws-cdk-lib';
import { StackSynthesizer, StackSynthesizerProps } from '../index';

/**
 * Synthesizes the cdk stack for a data product with an File Upload Source
 */
export class UploadSourceStackSynthesizer implements StackSynthesizer {
  public synthesize = async ({
    app,
    stackIdentifier,
    dataProduct,
    callingUser,
    staticInfrastructure,
  }: StackSynthesizerProps): Promise<Stack> => {
    return new FileUploadSourceTask(app, stackIdentifier, {
      dataProduct,
      callingUser,
      staticInfrastructure,
    });
  };
}
