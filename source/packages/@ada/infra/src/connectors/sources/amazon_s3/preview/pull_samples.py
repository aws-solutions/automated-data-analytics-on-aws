###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import re
import awswrangler as wr
import os

from handlers.common import * # NOSONAR
from handlers.sampling.common import SamplingUtils # NOSONAR

def pull_samples(input: IPullSamplesInput) -> IPullSamplesReturn: # NOSONAR (python:S3776) - false positive
    """
    Pull data samples from s3
    """
    boto3_session = input.boto3_session
    source_details = input.source_details
    sample_size = input.sample_size

    input_path = SamplingUtils.to_s3_path(source_details)

    # Perform a quick check to see if we have access to the bucket and if there are any objects
    response = input.boto3_session.client('s3').list_objects_v2(
        Bucket=source_details['bucket'], Prefix=source_details['key'])
    if 'Contents' not in response or len(response['Contents']) == 0:
        raise NoSourceDataFoundException(
            "No objects found under s3 path {}".format(input_path))

    # If there's only one object in the given s3 path, check it's not the key provided since s3 paths need to point
    # to a folder in order for glue to correctly crawl the data for querying in athena
    if len(response['Contents']) == 1 and response['Contents'][0]['Key'] == source_details['key']:
        raise NoSourceDataFoundException(
            "S3 path must point to a folder containing at least one file")

    # Get any subfolders relative to the given key, excluding those with the partition syntax (ie key=value) since these
    # are treated as partitions of the same dataset.
    # Non partition subfolders are treated as separate datasets to mimic the behaviour of a glue crawler.
    # See: https://aws.amazon.com/premiumsupport/knowledge-center/glue-crawler-multiple-tables/
    subfolders = [key[:-1] for key in [re.sub('{}/?'.format(source_details['key']), '', obj['Key']) for obj in response['Contents']] if key.endswith('/') and '=' not in key]

    # Non partition subfolders become the new dataset source paths
    paths = [(DEFAULT_DATASET_ID, input_path)] if len(subfolders) == 0 else [(folder, os.path.join(input_path, folder)) for folder in subfolders]
    printable_paths = ', '.join([path for (name, path) in paths])

    try:
        print("Attempting to read {} as parquet".format(printable_paths))
        return [Sample(name, next(wr.s3.read_parquet(path=path, chunked=sample_size, boto3_session=boto3_session)), 'parquet', path) for (name, path) in paths]
    except Exception as e:
        print("Failed to read as parquet: {}", e)

    try:
        # Assume records on separate lines for json.
        print("Attempting to read {} as json".format(printable_paths))
        # dtype=False solves issues when panda converts float into int https://github.com/pandas-dev/pandas/issues/20608
        return [Sample(name, next(wr.s3.read_json(path=path, chunksize=sample_size, lines=True, dtype=False, boto3_session=boto3_session)), 'json', path) for (name, path) in paths]
    except Exception as e:
        print("Failed to read as json: {}", e)

    try:
        print("Attempting to read {} as csv".format(printable_paths))
        return [SamplingUtils.pull_s3_csv_sample(boto3_session, name, path, sample_size) for (name, path) in paths]
    except Exception as e:
        print("Failed to read as csv: {}", e)

    raise UnsupportedDataFormatException(
        "Unable to load preview data from {}".format(printable_paths))
