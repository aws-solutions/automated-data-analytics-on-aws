###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
import os
import base64
import hashlib
import smart_open
import tempfile
from contextlib import nullcontext
from google.cloud import bigquery

MB = 1024 ** 2
GB = 1024 ** 3
TB = 1024 ** 4
QUERY = os.environ.get('QUERY')
S3_OUTPUT_BUCKET_URI = os.environ.get('S3_OUTPUT_BUCKET_URI')
if S3_OUTPUT_BUCKET_URI is None:
      raise Exception("missing s3 output bucket")

# remove the last slash from the path
if S3_OUTPUT_BUCKET_URI[-1:] == '/':
    S3_OUTPUT_BUCKET_URI = S3_OUTPUT_BUCKET_URI[:-1]

filename = hashlib.sha256(QUERY.encode('utf-8')).hexdigest()
bq_client = bigquery.Client()
bq_query = base64.b64decode(QUERY).decode("utf-8")

print(f'Executing query:\n {bq_query}')

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

table_size_bytes = dataframe.memory_usage(index=True).sum()

print(
    f'Writing data into S3... Estimated output size of {table_size_bytes / MB} MB (equivalent to {table_size_bytes / GB} GB or {table_size_bytes / TB} TB)'
)
# use a temp file to write data and minimise the number of parts if the table size is greater than 1 TB
# this will guarantee to not reach the 10k parts limit (will slow down the upload though)
with (tempfile.NamedTemporaryFile() if table_size_bytes / TB >= 1 else nullcontext()) as tmp:
    part_size = 500 * MB

    if (tmp is not None):
        part_size = 4 * GB

    print(
        f'Starting import with multipart size of {part_size / MB} MB (equal to {part_size / GB} GB)'
    )

    with smart_open.open(
        f'{S3_OUTPUT_BUCKET_URI}/{filename}.parquet',
        'wb',
        # min_part_size can be increased if there's enough memory in the container, max size is 5GB per part
        # the buffer is kept in memory till it raches the size and then written into S3 (generating a new 'part')
        # a small part size might end up generating too many parts and thus reach the 10k parts limits (if the content is on the order of TB)
        # more info: https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html
        #
        # alternatively the data can be stored in the local filesystem by using writebuffer prop but this requires a volume in the ECS container
        # by default the container comes with a 30GB disk: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-ami-storage-config.html
        # read/write io ops are slower than memory lookups
        # https://github.com/RaRe-Technologies/smart_open/blob/develop/howto.md#how-to-write-to-s3-efficiently
        transport_params={'min_part_size': part_size, 'writebuffer': tmp}
    ) as fout:
        dataframe.to_parquet(fout, engine='pyarrow', index=True)


print("Import completed")
