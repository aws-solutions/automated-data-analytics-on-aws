###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import sys
import traceback
import awswrangler as wr
import base64
import json

from handlers.common import * # NOSONAR
from handlers.sampling.common import * # NOSONAR

# copied from @ada/infra/src/connectors/**/*.py
from handlers.connectors import CONNECTORS

def pull_samples(data_product: IDataProduct, sample_size: int, calling_user: ICallingUser):
    """
    Pull a sample of data from a data product
    :returns: an array of samples, one for each detected data set in the data product
    """
    response = kms.decrypt(KeyId=KEY_ID, CiphertextBlob=base64.b64decode(
        data_product['sourceDetails']))
    source_type = data_product['sourceType']

    print("CONNECTORS:", list(CONNECTORS.keys()))

    try:
      _connector = CONNECTORS.get(source_type)

      if _connector != None:
        return _connector.pull_samples(IPullSamplesInput(
          sample_size=sample_size,
          source_details=SamplingUtils.add_data_ingress_network_info_to_source(json.loads(response["Plaintext"].decode('utf-8'))),
          update_trigger=data_product.get('updateTrigger', {}),
          boto3_session=SamplingUtils.assume_pull_data_sample_role(calling_user),
        ))
      else:
        print('Connector "{}" does not implement preview'.format(source_type))
        return []
    except Exception as e:
      traceback.print_exception(*sys.exc_info())
      print("Failed to pull sample for connector {}: {}", source_type, e)

def validate_csv_df(df):
    """
    Check whether the sampled csv dataframe is valid for use as a data product
    """
    num_columns = len(df.columns)
    num_rows = len(df)
    # Glue requires at least 2 columns and 2 rows for the crawler to successfully detect the csv details
    # https://docs.aws.amazon.com/glue/latest/dg/add-classifier.html#classifier-built-in
    if num_columns < 2 or num_rows < 2:
        raise UnsupportedSourceDataException(
            'CSV files must have at least 2 columns and 2 rows to import successfully. Found {} columns and {} sampled rows.'.format(num_columns, num_rows))


def to_csv_with_types(sample, path):
    """
    Write sample data to csv and preserve the type information in the first row
    """
    # Disable "index" to avoid adding extra row number column to data
    df = sample.df
    df.loc[-1] = df.dtypes
    df.index = df.index + 1
    df.sort_index(inplace=True)
    validate_csv_df(df)
    wr.s3.to_csv(df=df, path='{}/data.csv'.format(path), index=False)


def write_sample_to_s3(sample, path):
    """
    Write sample data to an s3 location
    """
    if sample.classification == 'csv':
        to_csv_with_types(sample, path)
    elif sample.classification == 'json':
        wr.s3.to_json(df=sample.df, path='{}/data.json'.format(path),
                      lines=True, orient='records')
    elif sample.classification == 'parquet':
        wr.s3.to_parquet(
            df=sample.df, path='{}/data.parquet'.format(path), index=False)
    else:
        # We can consider always writing as parquet here if we do not mind the potential to miss any automatic
        # transforms that should be added for the classification.
        raise UnsupportedDataFormatException(
            "Unable to write preview data to s3 as {}".format(sample.classification))


def write_sample(session_id, data_product, sample):
    """
    Write sample data to the preview temp bucket and return details expected by the other state machine handlers
    """
    path = SamplingUtils.to_s3_path({
        'bucket': TEMP_BUCKET_NAME,
        'key': '{}/{}/{}/source/{}'.format(data_product['domainId'], data_product['dataProductId'], session_id, sample.name)
    })

    write_sample_to_s3(sample, path)

    return {
        'tableName': sample.name,
        'sampleDataS3Path': path,
        'originalDataS3Path': sample.s3_path,
        'classification': sample.classification,
        'metadata': sample.metadata,
    }
