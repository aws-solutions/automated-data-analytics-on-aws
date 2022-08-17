/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProduct, DataProductPreview, DataProductUpdateTrigger, DataSets, Script } from '@ada/api';
import {
  DataProductUpdateTriggerType,
  GoogleServiceAccountAuth,
  SourceDetails,
  SourceDetailsFileUpload,
  SourceDetailsGoogleAnalytics,
  SourceDetailsGoogleBigQuery,
  SourceDetailsGoogleStorage,
  SourceDetailsKinesis,
  SourceDetailsS3,
  SourceType,
  SourceTypeDefinitions,
  StepFunctionExecutionStatus,
} from '@ada/common';
import { SCHEDULERATE_CUSTOM } from '$source-type';
import { nameToIdentifier } from '$common/utils/identifier';
import { previewSchemaToColumnMetadata } from '$common/utils';

const PATTERN_S3_PATH = /^s3:\/\/(?<bucket>[^/]+)(?:\/(?<key>.+))?$/;
const PATTERN_GS_PATH = /^gs:\/\/(?<bucket>[^/]+)(?:\/(?<key>.+))?$/;

export const supportedGlueDataTypes = [
  'byte',
  'short',
  'integer',
  'long',
  'float',
  'double',
  'decimal',
  'string',
  'boolean',
  'timestamp',
  'date',
];

export interface CustomTransformScript extends Omit<Script, 'source'> {
  inlineScriptContent: string;
}

export interface FormDataSchema {
  sourceDetails?: any;
  preview?: DataProductPreview;
  transforms?: DataProduct['transforms'];
}

export interface FormData
  extends Pick<
    DataProduct,
    | 'domainId'
    | 'name'
    | 'description'
    | 'sourceType'
    | 'enableAutomaticPii'
    | 'enableAutomaticTransforms'
    | 'updateTrigger'
  > {
  dataProductId?: string;
  initialFullAccessGroups?: string[];

  tags?: DataProduct['tags'];

  customTransforms?: Record<string, CustomTransformScript>;

  sourceDetails?: any;

  updateTrigger: DataProduct['updateTrigger'] & { customRate?: string };

  // source support
  isPreviewSupported?: boolean;
  skipPreview?: boolean;
  canSkipPreview?: boolean;
  // based on user action in schema preview next action
  skipTransform?: boolean;

  // form schema
  inferredSchema?: FormDataSchema;
  transformedSchema?: FormDataSchema;

  review?: any;

  // used to store helpers for computed fields that don't end up in data product
  wizard?: any;
}

export const marshalSourceDetails = (
  sourceType: DataProduct['sourceType'],
  details: any,
  updateTrigger: DataProductUpdateTrigger,
): SourceDetails => {
  switch (sourceType) {
    case SourceType.S3:
      return {
        bucket: PATTERN_S3_PATH.exec(details.s3Path)!.groups!.bucket,
        key: PATTERN_S3_PATH.exec(details.s3Path)!.groups!.key || '',
      } as SourceDetailsS3;
    case SourceType.UPLOAD:
      return {
        bucket: details.bucket,
        key: details.key,
      } as SourceDetailsFileUpload;
    case SourceType.KINESIS:
      return {
        kinesisStreamArn: details.kinesisStreamArn,
      } as SourceDetailsKinesis;
    case SourceType.GOOGLE_ANALYTICS:
    case SourceType.GOOGLE_BIGQUERY:
    case SourceType.GOOGLE_STORAGE: {
      const { projectId, clientEmail, privateKey, clientId, privateKeyId } = details;

      const serviceAccountAuth = {
        projectId,
        clientId,
        clientEmail,
        privateKeyId,
        privateKey,
      } as GoogleServiceAccountAuth;

      if (sourceType === SourceType.GOOGLE_ANALYTICS) {
        return {
          viewId: details.viewId,
          dimensions: details.dimensions.map((d: { label: string; value: string }) => d.value).join(','),
          metrics: details.metrics.map((m: { label: string; value: string }) => m.value).join(','),
          ...(updateTrigger.triggerType === DataProductUpdateTriggerType.ON_DEMAND ? {
            // convert the data format from iso to yyyy-MM-DD based on local date as ga does not take time stamps
            // en-ca formats the data as yyyy-MM-DD
            // scheduled import does not support start and end date form
            since: new Date(details.since).toLocaleDateString('en-CA'),
            until: new Date(details.until).toLocaleDateString('en-CA'),
          } : {}),
          ...serviceAccountAuth,
        } as SourceDetailsGoogleAnalytics;
      }

      if (sourceType === SourceType.GOOGLE_STORAGE) {
        return {
          bucket: PATTERN_GS_PATH.exec(details.googleStoragePath)!.groups!.bucket,
          key: PATTERN_GS_PATH.exec(details.googleStoragePath)!.groups!.key || '',
          ...serviceAccountAuth,
        } as SourceDetailsGoogleStorage;
      }

      return {
        query: details.query,
        ...serviceAccountAuth,
      } as SourceDetailsGoogleBigQuery;
    }
    default:
      throw new Error(`Source type "${sourceType}" is unsupported`);
  }
};

const generateDataSetsFromPreview = (preview?: DataProductPreview): DataSets => {
  if (preview?.status === StepFunctionExecutionStatus.SUCCEEDED) {
    return Object.fromEntries(
      Object.entries(preview.transformedDataSets!).map(([dataSetId, dataSet]) => [
        dataSetId,
        {
          identifiers: {},
          columnMetadata: previewSchemaToColumnMetadata(dataSet.schema),
        },
      ]),
    );
  }
  return {};
};

export const formDataToDataProduct = (formData: FormData): DataProduct => {
  const {
    domainId,
    name,
    description,
    sourceType,
    sourceDetails,
    tags,
    updateTrigger,
    inferredSchema = {},
    transformedSchema = {},
    skipPreview,
    skipTransform,
    enableAutomaticPii,
  } = formData;

  const supports = SourceTypeDefinitions[sourceType].CONFIG.supports;

  let dataSets: DataProduct['dataSets'] = {};
  let transforms: DataProduct['transforms'] | undefined = undefined;
  let enableAutomaticTransforms: DataProduct['enableAutomaticTransforms'] = undefined;

  if (skipPreview || !supports.preview) {
    dataSets = {}; // we won't know until imported since preview is disabled
    // automatically detect transforms during import
    transforms = undefined;
    enableAutomaticTransforms = supports.automaticTransforms;
  } else if (skipTransform || !supports.customTransforms) {
    dataSets = generateDataSetsFromPreview(inferredSchema.preview);
    // use inferred transforms if defined
    transforms = inferredSchema.transforms;
    enableAutomaticTransforms = supports.automaticTransforms && transforms == null;
  } else {
    dataSets = generateDataSetsFromPreview(transformedSchema.preview);
    // use inferred transforms if defined
    transforms = transformedSchema.transforms;
    enableAutomaticTransforms = supports.automaticTransforms && transforms == null;
  }

  return {
    domainId,
    name,
    description,
    dataProductId: nameToIdentifier(name),
    tags: tags || [],
    updateTrigger: {
      triggerType: updateTrigger.triggerType || DataProductUpdateTriggerType.ON_DEMAND,
      scheduleRate:
        updateTrigger.scheduleRate === SCHEDULERATE_CUSTOM ? updateTrigger.customRate : updateTrigger.scheduleRate,
      updatePolicy: updateTrigger.updatePolicy,
    },
    sourceType,
    sourceDetails: marshalSourceDetails(sourceType, sourceDetails, updateTrigger),
    dataSets: dataSets,
    parentDataProducts: [],
    childDataProducts: [],
    transforms: transforms || [],
    enableAutomaticPii,
    enableAutomaticTransforms,
  } as DataProduct;

};
