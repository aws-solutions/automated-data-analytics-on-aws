/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import { DataProductPreview, DataSetPreview } from '@ada/api';

export const DATAPRODUCT_PREVIEW_ID = 'test';

export const DATASET_PREVIEW: DataSetPreview = {
  classification: 'csv',
  data: [],
  schema: {
    dataType: 'struct',
    fields: [
      {
        name: 'name',
        container: {
          dataType: 'string',
        },
      },
      {
        name: 'age',
        container: {
          dataType: 'long',
        },
      },
      {
        name: 'nested',
        container: {
          dataType: 'struct',
          fields: [
            {
              name: 'nested_array',
              container: {
                dataType: 'array',
                elementType: {
                  dataType: 'byte',
                },
              },
            },
          ],
        },
      },
    ],
  },
  s3Path: 's3://test/path',
};

export const DATAPRODUCT_PREVIEW: DataProductPreview = {
  previewId: DATAPRODUCT_PREVIEW_ID,
  status: 'SUCCEEDED',
  initialDataSets: {
    test: DATASET_PREVIEW,
  },
  transformedDataSets: {
    test: DATASET_PREVIEW,
  },
  transformsApplied: [],
};
