###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
import awswrangler as wr
import io
import os
import base64
import uuid
import json
import csv
import boto3
from datetime import datetime
from dateutil import parser
from dateutil.relativedelta import relativedelta

import time
import pandas as pd
from constants import DEFAULT_DATASET_ID
from google.cloud import storage
from google.cloud import bigquery
from google.oauth2 import service_account
from apiclient.discovery import build
import urllib.parse
import re
import regex
import hashlib


GS_AVG_ROW_SIZE = 1024
TEMP_BUCKET_NAME = os.environ['TEMP_BUCKET_NAME']
KEY_ID = os.environ['KEY_ID']
kms = boto3.client('kms')
sts = boto3.client('sts')

VARCHAR_255 = 'varchar(255)'
DECIMAL_20_5 = 'decimal(20,5)'

class InternalError(Exception):
    pass


class DateRangeException(Exception):
    pass


class InvalidScheduleRateException(Exception):
    pass


class DateRangeException(Exception):
    pass


class InvalidScheduleRateException(Exception):
    pass


class NoSourceDataFoundException(Exception):
    pass


class UnsupportedSourceTypeException(Exception):
    pass


class UnsupportedDataFormatException(Exception):
    pass


class UnsupportedSourceDataException(Exception):
    pass


def to_s3_path(s3_location):
    return 's3://{}/{}'.format(s3_location['bucket'], s3_location['key'])


def from_s3_path(path):
    start_part = 's3://'
    if not path.startswith(start_part):
        raise InternalError('S3 path {} does not start with {}'.format(path, start_part))
    parts = path[len('s3://'):].split('/')
    return { 'bucket': parts[0], 'key': '/'.join(parts[1:]) }


def to_gs_path(gs_location):
    return 'gs://{}/{}'.format(gs_location['bucket'], gs_location['key'])


class Sample:
    def __init__(self, name, df, classification, s3_path=None, metadata=None):
        self.name = name
        self.df = df
        self.classification = classification
        self.s3_path = s3_path
        self.metadata = metadata


def get_hashed_and_sanitized_user_id(calling_user):
    """
    Returns hashed and sanitized user_id from the calling user based on session_name and tags constraint
    https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html
    Role session Name Length Constraints: Minimum length of 2. Maximum length of 64. Pattern: [\\w+=,.@-]*
    Tags values need to follow the pattern: [\\p{L}\\p{Z}\\p{N}_.:/=+\\-@]+
    """
    user_id = calling_user.get('userId')

    hashed_user_id = hashlib.sha256(
        'AssumeAsCaller-{}-{}'.format(user_id, round(time.time() * 1000)).encode('utf-8')).hexdigest()

    sanitized_user_id = regex.sub(
        r"[^\p{L}\p{Z}\p{N}_.:/=+\-]*", "", user_id, flags=regex.IGNORECASE)

    return {'hashed': hashed_user_id, 'sanitized': sanitized_user_id}


def assume_pull_data_sample_role(calling_user):
    """
    Assume the pull data sample role as the calling user. Returns a boto3 session
    Should be kept up to date with assume-role-as-caller.ts
    """
    user_id = get_hashed_and_sanitized_user_id(calling_user)
    assumed_role = sts.assume_role(
        RoleArn=os.environ['PULL_DATA_SAMPLE_ROLE_ARN'],
        RoleSessionName=user_id.get('hashed'),
        Tags=[
            {'Key': 'ada:service', 'Value': 'data-product'},
            {'Key': 'ada:user', 'Value': user_id.get('sanitized')},
            {'Key': 'ada:groups', 'Value': ':{}:'.format(
                ':'.join(calling_user['groups']))},
        ]
    )
    credentials = assumed_role['Credentials']
    return boto3.session.Session(
        aws_access_key_id=credentials['AccessKeyId'],
        aws_secret_access_key=credentials['SecretAccessKey'],
        aws_session_token=credentials['SessionToken'],
    )


def get_csv_metadata(boto3_session, path):
    """
    Get the metadata for a csv (eg its delimiter).
    This will throw an exception if it's not possible to get the metadata (eg it's not a csv!)
    """
    # Read the first 10KB from the first object in the path
    first_object_path = wr.s3.list_objects(path)[0]
    s3_location = from_s3_path(first_object_path)
    res = boto3_session.client('s3').get_object(Bucket=s3_location['bucket'], Key=s3_location['key'], Range='bytes=0-10000')

    # Attempt to extract information about the csv
    csv_info = csv.Sniffer().sniff(res['Body'].read().decode('utf-8'))
    return {
        'delimiter': csv_info.delimiter,
        'quotechar': csv_info.quotechar,
        'escapechar': csv_info.escapechar,
        'quoting': csv_info.quoting,
        'doublequote': csv_info.doublequote,
        'skipinitialspace': csv_info.skipinitialspace,
        'lineterminator': csv_info.lineterminator,
    }


def pull_s3_csv_sample(boto3_session, name, path, sample_size):
    """
    Pull the sample for a csv from s3, attempting to read extra metadata to better understand the csv (eg delimiter)
    """
    # Try to get CSV metadata. If this fails, we still try data wrangler
    metadata = None
    try:
        metadata = get_csv_metadata(boto3_session, path)
    except Exception as e:
        print("Unable to extract csv metadata (this might not be a csv file): {}", e)

    # csv.Sniffer (used in get_csv_metadata) is more reliable at inferring the separator than data wrangler, so we use
    # this inferred delimiter if available.
    extra_args = {} if metadata is None else { 'sep': metadata.get('delimiter'), 'engine': 'python' }
    return Sample(
        name,
        next(wr.s3.read_csv(path=path, chunksize=sample_size, boto3_session=boto3_session, **extra_args)),
        'csv',
        path,
        metadata,
    )


def s3_pull_samples(source_details, sample_size, boto3_session):
    """
    Pull data samples from s3
    """
    input_path = to_s3_path(source_details)

    # Perform a quick check to see if we have access to the bucket and if there are any objects
    response = boto3_session.client('s3').list_objects_v2(
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
        return [pull_s3_csv_sample(boto3_session, name, path, sample_size) for (name, path) in paths]
    except Exception as e:
        print("Failed to read as csv: {}", e)

    raise UnsupportedDataFormatException(
        "Unable to load preview data from {}".format(printable_paths))


def get_google_cloud_credentials(source_details):
    """
    Get Google Cloud Client credentials
    """
    return service_account.Credentials.from_service_account_info({
        "type": "service_account",
        "auth_uri": source_details["authUri"] if 'authUri' in source_details else "https://accounts.google.com/o/oauth2/auth",
        "token_uri": source_details["tokenUri"] if 'tokenUri' in source_details else "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": source_details["providerCertUrl"] if 'providerCertUrl' in source_details else "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": source_details["clientCertUrl"] if 'clientCertUrl' in source_details else "https://www.googleapis.com/robot/v1/metadata/x509/{}".format(urllib.parse.quote_plus(source_details["clientEmail"])),
        "project_id": source_details["projectId"],
        "client_id": source_details["clientId"],
        "client_email": source_details["clientEmail"],
        "private_key_id": source_details["privateKeyId"],
        "private_key": source_details["privateKey"],
    })


def bigquery_pull_samples(source_details, sample_size):
    """
    Pull data from Google Big Query
    """
    print('Reading data from Google Big Query')
    cred = get_google_cloud_credentials(source_details)
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


def google_analytics_pull_samples(source_details, sample_size, update_trigger): # NOSONAR (python:S3776) - false positive
    """
    Query data from Goolge Analytics
    https://developers.google.com/analytics/devguides/reporting/core/v4/rest/v4/reports/batchGet
    request body:
    {
        'viewId': '123456',
        'dateRanges': [{'startDate': '2021-01-01', 'endDate': '2021-12-01'}],
        'samplingLevel': 'Default|LARGE',
        'metrics': [],
        'dimensions': [],
        'pageSize': 10,
    }
    """
    print('Reading sample data from Google Analytics')
    cred = get_google_cloud_credentials(source_details)
    cred.with_scopes(["https://www.googleapis.com/auth/analytics.readonly"])
    analytics = build("analyticsreporting", "v4",
                      credentials=cred, cache_discovery=False)

    trigger_type = update_trigger.get("triggerType", "ON_DEMAND")
    schedule_rate = update_trigger.get("scheduleRate", "")

    date_range = get_date_range(source_details.get(
        "since"), source_details.get("until"), trigger_type, schedule_rate)

    print("Preview ga data with date ranges: ", date_range)

    since_formatted = date_range[0].strftime('%Y-%m-%d')

    until_formatted = date_range[1].strftime('%Y-%m-%d')

    """
    # input:
    # "ga:sessions, ga:users"
    # output:
    # [{"name": "ga:sessions"}, {"name": "ga:users"}]
    """
    source_dimenions = source_details.get("dimensions", {})
    if type(source_dimenions) is str:
        dimensions = []
        for dimension in source_dimenions.split(","):
            dimensions.append({"name": dimension})
    else:
        dimensions = source_dimenions

    """
    # input
    # "ga:country, ga:userType"
    # output
    # [{"expression": "ga:country"}, {"expression": "ga:userType"}]
    """
    source_metrics = source_details.get("metrics", {})

    if type(source_metrics) is str:
        metrics = []
        for metric in source_metrics.split(","):
            metrics.append({"expression": metric})
    else:
        metrics = source_metrics
    response = analytics.reports().batchGet(
        body={
            'reportRequests': [
                {
                    'viewId': source_details.get("viewId"),
                    'dateRanges': [{'startDate': since_formatted, 'endDate': until_formatted}],
                    'metrics': metrics,
                    'dimensions': dimensions,
                    'pageSize': sample_size
                }]
        }
    ).execute()

    print("Retrieved ga report for preview ...")

    if response.get('reports'):
        report = response['reports'][0]
        rows = report.get('data', {}).get('rows', [])

        column_header = report.get('columnHeader', {})
        dimension_headers = [
            {'name': header.replace('ga:', ''), 'type': VARCHAR_255}
            for header
            in column_header.get('dimensions', [])
        ]
        metric_map = {
            'METRIC_TYPE_UNSPECIFIED': VARCHAR_255,
            'CURRENCY': DECIMAL_20_5,
            'INTEGER': 'int(11)',
            'FLOAT': DECIMAL_20_5,
            'PERCENT': DECIMAL_20_5,
            'TIME': 'time'
        }
        metric_headers = [
            {'name': entry.get('name').replace('ga:', ''),
                'type': metric_map.get(entry.get('type'), VARCHAR_255)}
            for entry
            in column_header.get('metricHeader', {}).get('metricHeaderEntries', [])
        ]

        normalize_rows = []

        for row_counter, row in enumerate(rows):
            root_data_obj = {}
            dimensions = row.get('dimensions', [])
            metrics = row.get('metrics', [])

            for index, dimension in enumerate(dimensions):
                header = dimension_headers[index].get('name').lower()
                root_data_obj[header] = dimension

            for metric in metrics:
                data = {}
                data.update(root_data_obj)
                for index, value in enumerate(metric.get('values', [])):
                    header = metric_headers[index].get('name').lower()
                    data[header] = value
                data['viewid'] = source_details["viewId"]
                data['timestamp'] = until_formatted
                normalize_rows.append(data)
        print("normalized length: ", len(normalize_rows))
        if len(normalize_rows):
            dataframe = pd.DataFrame(normalize_rows)
            return [Sample(DEFAULT_DATASET_ID, dataframe, 'parquet')]
        else:
            raise NoSourceDataFoundException(
                "Unable to load preview: empty data")
    else:
        raise NoSourceDataFoundException(
            "Unable to load preview: bad responses from google analytics")

def get_date_range(since, until, trigger_type, schedule_rate=""): # NOSONAR (S3776:Complexity) - won't fix
    """
    Get Date Range
    ondemand/once-off:
        use date range parsed from client side if
    scheduled:
        calculate the date range based on utc time now
        e.g. if weekly, start = 1 week ago, end = utc now
    """
    try:
        since_date = parser.parse(since).date()
    except (TypeError, OverflowError, parser.ParserError):
        print("Failed to parse start date: ", since)
        since_date = None
    try:
        until_date = parser.parse(until).date()
    except (TypeError, OverflowError, parser.ParserError):
        print("Failed to parse end date: ", until)
        until_date = None

    today = datetime.utcnow().date()

    if trigger_type == "SCHEDULE":
        if schedule_rate is None or schedule_rate == "":
            raise InvalidScheduleRateException(
                "Invalid schedule frequency: ", schedule_rate)
        elif until_date and today > until_date:
            raise DateRangeException("Expired schedule")
        elif since_date and since_date > today:
            raise DateRangeException("Import has not started yet")
        else:
            pattern = 'rate\((\d+)\s(days?|weeks?|months?)\)'
            matched = re.findall(
                pattern, schedule_rate, flags=re.IGNORECASE)
            if len(matched) == 1:
                freq = int(matched[0][0])
                freq_unit = str(matched[0][1])
                freq_unit = freq_unit + \
                    ("" if freq_unit.endswith("s") else "s")
                delta = relativedelta()
                setattr(delta, freq_unit, freq)
                last_n = today - delta
                print("freq: ", freq_unit, ", delta: ", delta)
                print(last_n, today)
                return last_n, today
            else:
                raise InvalidScheduleRateException(
                    "Not supported schedule rate")
    else:
        # treat everything else as once off
        print("On demand impmorting")
        if since_date is None or until_date is None:
            raise UnsupportedDataFormatException("Not supported date format")
        elif since_date > until_date:
            raise DateRangeException(
                "Start date cannot be greater than end date")
        return since_date, until_date


def get_rows_from_stream(stream, size, remove_last_row=True):
    """
    Get the X number of rows from a stream, the delimiter is newline
    """
    stream.seek(0)
    lines = stream.readlines()
    if (remove_last_row):
        lines = lines[:-1]  # remove the last line as might be partial

    return lines[:size]  # get only the first X rows


def list_to_bytes_stream(list, delimiter=b'\n'):
    """
    Convert a list to a stream object (BytesIO)
    """
    return io.BytesIO(bytes(delimiter.join(list)))


def google_storage_pull_samples(source_details, sample_size):
    """
    Pull data from Google Storage
    """
    print('Reading data from Google Storage')
    cred = get_google_cloud_credentials(source_details)
    storage_client = storage.Client(
        credentials=cred, project=source_details["projectId"])
    path = to_gs_path(source_details)
    stream = io.BytesIO()

    try:
        print("Attempting to read {} as csv".format(path))

        storage_client.download_blob_to_file(
            path, stream, start=0, end=sample_size * GS_AVG_ROW_SIZE)
        lines = get_rows_from_stream(stream, sample_size + 1)

        # what if other chars are used as delimiter?
        return [Sample(DEFAULT_DATASET_ID, pd.read_csv(list_to_bytes_stream(lines), sep=","), 'csv')]
    except Exception as e:
        print("Failed to read as csv: {}", e)

    try:
        print("Attempting to read {} as json".format(path))

        stream.seek(0)
        stream.truncate(0)
        storage_client.download_blob_to_file(
            path, stream, start=0, end=sample_size * GS_AVG_ROW_SIZE)
        lines = get_rows_from_stream(stream, sample_size + 1)

        # parse only line-delimited json
        return [Sample(DEFAULT_DATASET_ID, pd.read_json(list_to_bytes_stream(lines), lines=True), 'json')]
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


def pull_samples(data_product, sample_size, calling_user):
    """
    Pull a sample of data from a data product
    :returns: an array of samples, one for each detected data set in the data product
    """
    response = kms.decrypt(KeyId=KEY_ID, CiphertextBlob=base64.b64decode(
        data_product['sourceDetails']))
    source_type = data_product['sourceType']
    update_trigger = data_product.get('updateTrigger', {})
    source_details = json.loads(response["Plaintext"].decode('utf-8'))

    boto3_session = assume_pull_data_sample_role(calling_user)

    if source_type == 'S3' or source_type == 'UPLOAD':
        return s3_pull_samples(source_details, sample_size, boto3_session)
    elif source_type == 'QUERY':
        # NOTE: Support query source sample!
        pass
    elif source_type == 'KINESIS':
        # NOTE: Support kinesis source sample!
        pass
    elif source_type == 'GOOGLE_STORAGE':
        return google_storage_pull_samples(source_details, sample_size)
    elif source_type == 'GOOGLE_BIGQUERY':
        return bigquery_pull_samples(source_details, sample_size)
    elif source_type == 'GOOGLE_ANALYTICS':
        return google_analytics_pull_samples(source_details, sample_size, update_trigger)
    raise UnsupportedSourceTypeException(
        'Schema preview not supported for source type {}'.format(source_type))


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
    path = to_s3_path({
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


def handler(event, _): # NOSONAR
    """
    Handler for pulling sample data for a data product
    """
    payload = event['Payload']
    data_product = payload['dataProduct']
    sample_size = payload['sampleSize']
    calling_user = payload['callingUser']

    session_id = uuid.uuid4()
    print('Starting transforms with session id {}'.format(session_id))

    samples = pull_samples(data_product, sample_size, calling_user)

    payload['tableDetails'] = []

    for sample in samples:
        payload['tableDetails'].append(
            write_sample(session_id, data_product, sample))

    return payload
