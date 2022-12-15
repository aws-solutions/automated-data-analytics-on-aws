/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductTransform, DataSetIdentifiers, S3Location } from '@ada/api';
export { DefaultUser, DataProductEventDetailTypes } from '@ada/common';


/**
 * Details required to perform a transform job on a data product
 */
export interface TransformJob extends DataProductTransform {
  readonly applicableClassifications?: string[];
  readonly glueJobName: string;
  readonly outputS3Target: S3Location;
  readonly outputS3TargetPath: string;
  readonly tempS3Path: string;
  readonly outputCrawlerName: string;
  readonly outputCrawlerTablePrefix: string;
}

/**
 * A transform job ready to run on a particular table
 */
export interface ResolvedTransformJob extends TransformJob {
  readonly inputTableName: string;
}

export interface TableDescriptor {
  readonly tableName: string;
  readonly classification: string;
}

/**
 * Define the crawled table details resulted as output from the dynamic data product infrastructure execution
 */
export interface CrawledTableDetail extends TableDescriptor {
  readonly tableNameSuffix: string;
  readonly location: string;
  readonly compressed: boolean;
  readonly recordCount: number;
  readonly averageRecordSize: number;
  readonly compressionType?: string;
  readonly columns: Array<{
    name: string;
    type: string;
    piiClassification?: string;
  }>;
  readonly identifiers: DataSetIdentifiers;
}
