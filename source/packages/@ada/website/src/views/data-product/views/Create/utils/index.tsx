/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { Connectors } from '@ada/connectors';
import { DataProduct, DataProductPreview, DataProductUpdateTrigger, DataSets, Script } from '@ada/api';
import { DataProductUpdateTriggerType, StepFunctionExecutionStatus } from '@ada/common';
import { SCHEDULERATE_CUSTOM } from '$connectors/common';
import { nameToIdentifier } from '$common/utils/identifier';
import { previewSchemaToColumnMetadata } from '$common/utils';

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
  sourceType: Connectors.ID,
  sourceDetails: any,
  updateTrigger: DataProductUpdateTrigger,
): Connectors.SourceDetails => {
  const connector = Connectors.find(sourceType);

  return connector.VIEW.Wizard.sourceDetailsFormDataToInputData({ sourceDetails, updateTrigger });
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

  const supports = Connectors.find(sourceType).CONFIG.supports;

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

  // if connector doesn't support automatic PII detection, turn it off
  const overrideEnableAutomaticPii = supports.disableAutomaticPii ? false : enableAutomaticPii;

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
    enableAutomaticPii: overrideEnableAutomaticPii,
    enableAutomaticTransforms,
  } as DataProduct;
};
