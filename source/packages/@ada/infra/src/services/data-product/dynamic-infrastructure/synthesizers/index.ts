/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { ApiClient } from '@ada/api-client-lambda';
import { App, Stack, Tags } from 'aws-cdk-lib';
import { CallingUser, SourceType } from '@ada/common';
import { DataProduct } from '@ada/api';
import { GoogleAnalyticsSourceStackSynthesizer } from './google-analytics-source-stack-synthesizer';
import { GoogleBigQuerySourceStackSynthesizer } from './google-bigquery-source-stack-synthesizer';
import { GoogleStorageSourceStackSynthesizer } from './google-storage-source-stack-synthesizer';
import { KinesisSourceStackSynthesizer } from './kinesis-source-stack-synthesizer';
import { QuerySourceStackSynthesizer } from './query-source-stack-synthesizer';
import { S3SourceStackSynthesizer } from './s3-source-stack-synthesizer';
import { StaticInfrastructure } from '@ada/microservice-common';
import { UploadSourceStackSynthesizer } from './upload-source-stack.synthesizer';
import { VError } from 'verror';
import { applyApplicationTags } from '@ada/infra-common';
export interface StackSynthesizerProps {
  readonly app: App;
  readonly api: ApiClient;
  readonly stackIdentifier: string;
  readonly dataProduct: DataProduct;
  readonly callingUser: CallingUser;
  readonly staticInfrastructure: StaticInfrastructure;
}

export interface StackSynthesizer {
  synthesize: (props: StackSynthesizerProps) => Promise<Stack>;
}

// Register synthesizers for source types here
const SYNTHESIZERS = {
  [SourceType.S3]: new S3SourceStackSynthesizer(),
  [SourceType.QUERY]: new QuerySourceStackSynthesizer(), //NOSONAR (S1874:Deprecated) - ignore
  [SourceType.UPLOAD]: new UploadSourceStackSynthesizer(),
  [SourceType.KINESIS]: new KinesisSourceStackSynthesizer(),
  [SourceType.GOOGLE_STORAGE]: new GoogleStorageSourceStackSynthesizer(),
  [SourceType.GOOGLE_BIGQUERY]: new GoogleBigQuerySourceStackSynthesizer(),
  [SourceType.GOOGLE_ANALYTICS]: new GoogleAnalyticsSourceStackSynthesizer(),
};

/**
 * Synthesize the appropriate CDK stack for the data product. Other additional data gathering/computation can be done
 * prior to the cdk synth.
 * @param props stack synthesis props
 */
export const synthesizeStack = async (props: StackSynthesizerProps): Promise<Stack> => {
  const synthesizer = SYNTHESIZERS[props.dataProduct.sourceType];
  if (!synthesizer) {
    throw new VError(
      { name: 'UnsupportedSourceTypeError' },
      `Unsupported data product source type: ${props.dataProduct.sourceType}`,
    );
  }
  const synthesizedStack = await synthesizer.synthesize(props);

  applyApplicationTags(synthesizedStack);

  // data product tags
  Tags.of(synthesizedStack).add('DataProductId', props.dataProduct.dataProductId);
  Tags.of(synthesizedStack).add('DomainId', props.dataProduct.domainId);

  return synthesizedStack;
};
