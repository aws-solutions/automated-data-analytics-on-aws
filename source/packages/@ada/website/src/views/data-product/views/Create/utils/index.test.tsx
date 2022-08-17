/*! Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0 */
import * as fixtures from '$testing/__fixtures__';
import { DataProductUpdatePolicy, DataProductUpdateTriggerType, SourceType, SourceTypeDefinitions } from '@ada/common';
import { Schema, Validator } from 'jsonschema';
import { formDataToDataProduct, marshalSourceDetails } from './';

const SchemaValidator = new Validator();

describe('data-product/create/utils', () => {
  describe('marshalSourceDetails', () => {
    it(SourceType.S3, () => {
      const sourceDetails = marshalSourceDetails(
        SourceType.S3,
        {
          s3Path: 's3://bucket/key',
        },
        {
          triggerType: DataProductUpdateTriggerType.ON_DEMAND,
        },
      );
      expect(sourceDetails).toMatchObject({
        bucket: 'bucket',
        key: 'key',
      });
      // validate output matches schema so will be accepable to api validation
      expect(SchemaValidator.validate(sourceDetails, SourceTypeDefinitions.S3.SCHEMA as Schema).errors).toEqual([]);
    });

    it(SourceType.KINESIS, () => {
      const sourceDetails = marshalSourceDetails(
        SourceType.KINESIS,
        {
          kinesisStreamArn: 'arn:aws:kinesis:region:1234567890:stream/stream-name',
        },
        {
          triggerType: DataProductUpdateTriggerType.ON_DEMAND,
        },
      );
      expect(sourceDetails).toMatchObject({
        kinesisStreamArn: 'arn:aws:kinesis:region:1234567890:stream/stream-name',
      });
      // validate output matches schema so will be accepable to api validation
      expect(SchemaValidator.validate(sourceDetails, SourceTypeDefinitions.KINESIS.SCHEMA as Schema).errors).toEqual(
        [],
      );
    });

    it(SourceType.UPLOAD, () => {
      const sourceDetails = marshalSourceDetails(
        SourceType.UPLOAD,
        {
          bucket: 'bucket',
          key: 'key',
        },
        {
          triggerType: DataProductUpdateTriggerType.ON_DEMAND,
        },
      );
      expect(sourceDetails).toMatchObject({
        bucket: 'bucket',
        key: 'key',
      });
      // validate output matches schema so will be accepable to api validation
      expect(SchemaValidator.validate(sourceDetails, SourceTypeDefinitions.UPLOAD.SCHEMA as Schema).errors).toEqual([]);
    });

    it(SourceType.GOOGLE_STORAGE + ' storage path', () => {
      const sourceDetails = marshalSourceDetails(
        SourceType.GOOGLE_STORAGE,
        {
          ...fixtures.GOOGLE_SERVICE_ACCOUNT,
          googleStoragePath: 'gs://bucket/some/key',
        },
        {
          triggerType: DataProductUpdateTriggerType.SCHEDULE,
        },
      );
      expect(sourceDetails).toMatchObject({
        bucket: 'bucket',
        key: 'some/key',
        ...fixtures.GOOGLE_SERVICE_ACCOUNT,
      });
      // validate output matches schema so will be accepable to api validation
      expect(
        SchemaValidator.validate(sourceDetails, SourceTypeDefinitions.GOOGLE_STORAGE.SCHEMA as Schema).errors,
      ).toEqual([]);
    });

    it(SourceType.GOOGLE_BIGQUERY, () => {
      const sourceDetails = marshalSourceDetails(
        SourceType.GOOGLE_BIGQUERY,
        {
          ...fixtures.GOOGLE_SERVICE_ACCOUNT,
          query: 'SELECT * FROM foo',
        },
        {
          triggerType: DataProductUpdateTriggerType.ON_DEMAND,
        },
      );
      expect(sourceDetails).toMatchObject({
        query: 'SELECT * FROM foo',
        ...fixtures.GOOGLE_SERVICE_ACCOUNT,
      });
      // validate output matches schema so will be accepable to api validation
      expect(
        SchemaValidator.validate(sourceDetails, SourceTypeDefinitions.GOOGLE_BIGQUERY.SCHEMA as Schema).errors,
      ).toEqual([]);
    });
    it(SourceType.GOOGLE_ANALYTICS, () => {
      const sourceDetails = marshalSourceDetails(
        SourceType.GOOGLE_ANALYTICS,
        {
          ...fixtures.GOOGLE_SERVICE_ACCOUNT,
          viewId: '1234567891',
          since: '2020-12-31T10:29:28.094Z',
          until: '2021-11-26T10:29:28.094Z',
          dimensions: [
            { label: 'ga:country', value: 'ga:country' },
            { label: 'ga:userType', value: 'ga:userType' },
          ],
          metrics: [
            { label: 'ga:sessions', value: 'ga:sessions' },
            { label: 'ga:users', value: 'ga:users' },
          ],
        },
        {
          triggerType: DataProductUpdateTriggerType.ON_DEMAND,
        },
      );
      expect(sourceDetails).toMatchObject({
        ...fixtures.GOOGLE_SERVICE_ACCOUNT,
        viewId: '1234567891',
        since: '2020-12-31',
        until: '2021-11-26',
        dimensions: 'ga:country,ga:userType',
        metrics: 'ga:sessions,ga:users',
      });
      // validate output matches schema so will be accepable to api validation
      expect(
        SchemaValidator.validate(sourceDetails, SourceTypeDefinitions.GOOGLE_ANALYTICS.SCHEMA as Schema).errors,
      ).toEqual([]);
    });
  });

  describe('formDatatoDataProduct', () => {
    it('should build a data product from from form data', () => {
      expect(
        formDataToDataProduct({
          name: 'SomeName',
          domainId: 'test',
          sourceType: SourceType.S3,
          sourceDetails: {
            s3Path: 's3://bucket/some/key',
          },
          updateTrigger: {
            triggerType: DataProductUpdateTriggerType.ON_DEMAND,
          },
        }),
      ).toEqual({
        name: 'SomeName',
        domainId: 'test',
        dataProductId: 'some_name',
        sourceType: SourceType.S3,
        sourceDetails: {
          bucket: 'bucket',
          key: 'some/key',
        },
        updateTrigger: {
          triggerType: DataProductUpdateTriggerType.ON_DEMAND,
          scheduleRate: undefined,
        },
        // initialFullAccessGroups: ['group-1', 'group-2'],
        dataSets: {},
        parentDataProducts: [],
        childDataProducts: [],
        enableAutomaticTransforms: true,
        transforms: [],
        tags: [],
      });
    });

    it('should build a scheduled data product from from output', () => {
      expect(
        formDataToDataProduct({
          name: 'SomeName',
          domainId: 'test',
          sourceType: SourceType.S3,
          sourceDetails: {
            s3Path: 's3://bucket/some/key',
          },
          updateTrigger: {
            triggerType: DataProductUpdateTriggerType.SCHEDULE,
            scheduleRate: 'custom',
            customRate: 'rate(2 days)',
          },
        }),
      ).toEqual({
        name: 'SomeName',
        domainId: 'test',
        dataProductId: 'some_name',
        sourceType: SourceType.S3,
        sourceDetails: {
          bucket: 'bucket',
          key: 'some/key',
        },
        updateTrigger: {
          triggerType: DataProductUpdateTriggerType.SCHEDULE,
          scheduleRate: 'rate(2 days)',
        },
        dataSets: {},
        parentDataProducts: [],
        childDataProducts: [],
        enableAutomaticTransforms: true,
        transforms: [],
        tags: [],
      });
    });

    it('should build a data product with inferred schema', () => {
      expect(
        formDataToDataProduct({
          name: 'some name',
          domainId: 'test',
          sourceType: SourceType.GOOGLE_BIGQUERY,
          sourceDetails: {
            ...fixtures.GOOGLE_SERVICE_ACCOUNT,
            query: 'SELECT * FROM foo',
          },
          updateTrigger: {
            triggerType: DataProductUpdateTriggerType.ON_DEMAND,
          },
          skipTransform: true,
          inferredSchema: {
            transforms: [
              { namespace: 'test', scriptId: 'scrip1' },
              { namespace: 'global', scriptId: 'global1' },
            ],
          },
        }),
      ).toMatchObject({
        enableAutomaticTransforms: false,
        transforms: [
          { namespace: 'test', scriptId: 'scrip1' },
          { namespace: 'global', scriptId: 'global1' },
        ],
      });
    });

    it('should build a data product with custom transformed schema', () => {
      expect(
        formDataToDataProduct({
          name: 'some name',
          domainId: 'test',
          sourceType: SourceType.GOOGLE_BIGQUERY,
          sourceDetails: {
            ...fixtures.GOOGLE_SERVICE_ACCOUNT,
            query: 'SELECT * FROM foo',
          },
          updateTrigger: {
            triggerType: DataProductUpdateTriggerType.ON_DEMAND,
          },
          skipTransform: false,
          transformedSchema: {
            transforms: [
              { namespace: 'test', scriptId: 'scrip1' },
              { namespace: 'global', scriptId: 'global1' },
            ],
          },
        }),
      ).toMatchObject({
        enableAutomaticTransforms: false,
        transforms: [
          { namespace: 'test', scriptId: 'scrip1' },
          { namespace: 'global', scriptId: 'global1' },
        ],
      });
    });

    it('should ignore inferred schema if preview is skipped by user', () => {
      expect(
        formDataToDataProduct({
          name: 'some name',
          domainId: 'test',
          sourceType: SourceType.GOOGLE_BIGQUERY,
          sourceDetails: {
            ...fixtures.GOOGLE_SERVICE_ACCOUNT,
            query: 'SELECT * FROM foo',
          },
          updateTrigger: {
            triggerType: DataProductUpdateTriggerType.ON_DEMAND,
          },
          skipPreview: true,
          // provide the schema, but is skipped above
          inferredSchema: {
            transforms: [
              { namespace: 'test', scriptId: 'scrip1' },
              { namespace: 'global', scriptId: 'global1' },
            ],
          },
        }),
      ).toMatchObject({
        enableAutomaticTransforms: true,
        transforms: [],
      });
    });

    it('should revert to inferred schema if transform schema is skipped by user', () => {
      expect(
        formDataToDataProduct({
          name: 'some name',
          domainId: 'test',
          sourceType: SourceType.GOOGLE_BIGQUERY,
          sourceDetails: {
            ...fixtures.GOOGLE_SERVICE_ACCOUNT,
            query: 'SELECT * FROM foo',
          },
          updateTrigger: {
            triggerType: DataProductUpdateTriggerType.ON_DEMAND,
          },
          skipPreview: false,
          // provide the schema, but is skipped above
          inferredSchema: {
            transforms: [
              { namespace: 'i_test', scriptId: 'scrip1' },
              { namespace: 'i_global', scriptId: 'global1' },
            ],
          },
          skipTransform: true,
          // provide the schema, but is skipped above
          transformedSchema: {
            transforms: [
              { namespace: 't_test', scriptId: 'scrip1' },
              { namespace: 't_global', scriptId: 'global1' },
            ],
          },
        }),
      ).toMatchObject({
        enableAutomaticTransforms: false,
        // should match inferred schema, not transformed
        transforms: [
          { namespace: 'i_test', scriptId: 'scrip1' },
          { namespace: 'i_global', scriptId: 'global1' },
        ],
      });
    });

    it('should ignore inferred+transformed schemas if source does not support preview', () => {
      expect(
        formDataToDataProduct({
          name: 'some name',
          domainId: 'test',
          sourceType: SourceType.KINESIS,
          sourceDetails: {
            kinesisArn: 'test-arn',
          },
          updateTrigger: {
            triggerType: DataProductUpdateTriggerType.AUTOMATIC,
          },
          // provide the schema, but not supported so ignored
          inferredSchema: {
            transforms: [
              { namespace: 'i_test', scriptId: 'scrip1' },
              { namespace: 'i_global', scriptId: 'global1' },
            ],
          },
          // provide the schema, but not supported so ignored
          transformedSchema: {
            transforms: [
              { namespace: 't_test', scriptId: 'scrip1' },
              { namespace: 't_global', scriptId: 'global1' },
            ],
          },
        }),
      ).toMatchObject({
        enableAutomaticTransforms: true,
        transforms: [],
      });
    });

    it('should build a data product for Google Analytics scheduled import', () => {
      expect(
        formDataToDataProduct({
          name: 'ga import',
          domainId: 'test',
          description: 'google analytics import',
          sourceType: SourceType.GOOGLE_ANALYTICS,
          enableAutomaticPii: false,
          sourceDetails: {
            ...fixtures.GOOGLE_SERVICE_ACCOUNT,
            viewId: '1234567891',
            dimensions: [
              { label: 'ga:country', value: 'ga:country' },
              { label: 'ga:userType', value: 'ga:userType' },
            ],
            metrics: [
              { label: 'ga:sessions', value: 'ga:sessions' },
              { label: 'ga:users', value: 'ga:users' },
            ],
          },
          updateTrigger: {
            triggerType: DataProductUpdateTriggerType.SCHEDULE,
            scheduleRate: 'rate(7 days)',
            updatePolicy: DataProductUpdatePolicy.APPEND,
          },
        }),
      ).toEqual({
        name: 'ga import',
        domainId: 'test',
        dataProductId: 'ga_import',
        description: 'google analytics import',
        enableAutomaticPii: false,
        sourceType: SourceType.GOOGLE_ANALYTICS,
        sourceDetails: {
          ...fixtures.GOOGLE_SERVICE_ACCOUNT,
          viewId: '1234567891',
          dimensions: 'ga:country,ga:userType',
          metrics: 'ga:sessions,ga:users',
        },
        updateTrigger: {
          scheduleRate: 'rate(7 days)',
          triggerType: DataProductUpdateTriggerType.SCHEDULE,
          updatePolicy: DataProductUpdatePolicy.APPEND,
        },
        tags: [],
        dataSets: {},
        parentDataProducts: [],
        childDataProducts: [],
        enableAutomaticTransforms: true,
        transforms: [],
      });
    });
  });
});
