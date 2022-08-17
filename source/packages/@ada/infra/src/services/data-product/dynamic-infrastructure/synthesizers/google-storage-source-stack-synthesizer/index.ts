/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { GoogleStorageSourceTask } from '../../stacks';
import { Stack } from 'aws-cdk-lib';
import { StackSynthesizer, StackSynthesizerProps } from '../index';

/**
 * Synthesizes the cdk stack for a data product with Google Storage Source
 */
export class GoogleStorageSourceStackSynthesizer implements StackSynthesizer {
  public synthesize = async ({
    app,
    stackIdentifier,
    dataProduct,
    callingUser,
    staticInfrastructure,
  }: StackSynthesizerProps): Promise<Stack> => {
    return new GoogleStorageSourceTask(app, stackIdentifier, {
      dataProduct,
      callingUser,
      staticInfrastructure,
    });
  };
}
