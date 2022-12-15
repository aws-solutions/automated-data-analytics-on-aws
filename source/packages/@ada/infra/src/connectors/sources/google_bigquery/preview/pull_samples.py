###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
from google.cloud import bigquery

from handlers.common import * # NOSONAR
from handlers.sampling.common import SamplingUtils # NOSONAR

def pull_samples(input: IPullSamplesInput) -> IPullSamplesReturn: # NOSONAR (python:S3776) - false positive
    """
    Pull data from Google Big Query
    """
    print('Reading data from Google Big Query')

    source_details = input.source_details
    sample_size = input.sample_size

    cred = SamplingUtils.get_google_cloud_credentials(source_details)
    bq_client = bigquery.Client(
        credentials=cred, project=source_details["projectId"])
    bq_query = "SELECT * FROM ({}) LIMIT {}".format(
        source_details["query"], sample_size)
    results = bq_client.query(bq_query).result()
    """
    Time data type is mapped to INT64 TIMESTAMP_MICROS in parquet which results illegal type in spark query.
    Explicitly convert it to string to avoid error in spark.
    https://googleapis.dev/python/bigquery/latest/_modules/google/cloud/bigquery/table.html#RowIterator.to_dataframe
    https://github.com/apache/spark/blob/11d3a744e20fe403dd76e18d57963b6090a7c581/sql/core/src/main/scala/org/apache/spark/sql/execution/datasources/parquet/ParquetSchemaConverter.scala#L151
    """
    dtypes = {}
    for column in results.schema:
        if column.field_type == 'TIME':
            dtypes[column.name] = 'string'
    dataframe = (
        results
        .to_dataframe(
            create_bqstorage_client=True,
            dtypes=dtypes
        )
    )
    return [Sample(DEFAULT_DATASET_ID, dataframe, 'parquet')]
