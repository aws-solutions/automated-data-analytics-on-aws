###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import io
import pandas as pd
from google.cloud import storage

from handlers.common import * # NOSONAR
from handlers.sampling.common import SamplingUtils # NOSONAR

GS_AVG_ROW_SIZE = 1024

def to_gs_path(gs_location):
    return 'gs://{}/{}'.format(gs_location['bucket'], gs_location['key'])


def pull_samples(input: IPullSamplesInput) -> IPullSamplesReturn: # NOSONAR (python:S3776) - false positive
    """
    Pull data from Google Storage
    """
    print('Reading data from Google Storage')

    source_details = input.source_details
    sample_size = input.sample_size

    cred = SamplingUtils.get_google_cloud_credentials(source_details)
    storage_client = storage.Client(
        credentials=cred, project=source_details["projectId"])
    path = to_gs_path(source_details)
    stream = io.BytesIO()

    try:
        print("Attempting to read {} as csv".format(path))

        storage_client.download_blob_to_file(
            path, stream, start=0, end=sample_size * GS_AVG_ROW_SIZE)
        lines = SamplingUtils.get_rows_from_stream(stream, sample_size + 1)

        # what if other chars are used as delimiter?
        return [Sample(DEFAULT_DATASET_ID, pd.read_csv(SamplingUtils.list_to_bytes_stream(lines), sep=","), 'csv')]
    except Exception as e:
        print("Failed to read as csv: {}", e)

    try:
        print("Attempting to read {} as json".format(path))

        stream.seek(0)
        stream.truncate(0)
        storage_client.download_blob_to_file(
            path, stream, start=0, end=sample_size * GS_AVG_ROW_SIZE)
        lines = SamplingUtils.get_rows_from_stream(stream, sample_size + 1)

        # parse only line-delimited json
        return [Sample(DEFAULT_DATASET_ID, pd.read_json(SamplingUtils.list_to_bytes_stream(lines), lines=True), 'json')]
    except Exception as e:
        print("Failed to read as json: {}", e)

    try:
        print("Attempting to read {} as parquet".format(path))

        stream.seek(0)
        stream.truncate(0)
        # can't define a "partial" file as parquet is a column based format (so would require the entire file to read just one row)
        storage_client.download_blob_to_file(path, stream)

        return [Sample(DEFAULT_DATASET_ID, pd.read_parquet(stream).head(sample_size + 1), 'parquet')]
    except Exception as e:
        print("Failed to read as parquet: {}", e)

    raise UnsupportedDataFormatException(
        "Unable to load preview data from {}".format(path))
