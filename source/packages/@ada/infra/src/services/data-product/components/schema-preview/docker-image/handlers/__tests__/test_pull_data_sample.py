###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################
import pytest
import pull_data_sample
import base64
import json
import pandas as pd
import time
from google.oauth2 import service_account
from constants import DEFAULT_DATASET_ID
from unittest.mock import patch, MagicMock
from datetime import datetime
from dateutil.relativedelta import relativedelta

def _pull_data_sample(source_type, source_details):
    return pull_data_sample.handler({
        "Payload": {
            "sampleSize": 10,
            "dataProduct": {
                "dataProductId": "test-data-product",
                "domainId": "test-domain",
                "sourceType": source_type,
                "sourceDetails": base64.b64encode(json.dumps(source_details).encode("utf-8"))
            },
            "callingUser": {
                "userId": "darthvader",
                "groups": ["sith", "skywalker"]
            }
        }
    }, None)

def _pull_scheduled_data_sample(source_type, source_details):
    return pull_data_sample.handler({
        "Payload": {
            "sampleSize": 10,
            "dataProduct": {
                "dataProductId": "test-data-product",
                "domainId": "test-domain",
                "sourceType": source_type,
                "sourceDetails": base64.b64encode(json.dumps(source_details).encode("utf-8")),
                "updateTrigger": {
                    "triggerType": "SCHEDULE",
                    "scheduleRate": "rate(1 month)",
                    "updatePolicy": "APPEND"
                }
            },
            "callingUser": {
                "userId": "darthvader",
                "groups": ["sith", "skywalker"]
            }
        }
    }, None)
test_df = pd.DataFrame(data={'col1': [1, 2], 'col2': [3, 4]})

@pytest.mark.parametrize("calling_user", [{"userId": "auth0_auth0|61dcd9cdc4b05c0069a392de"}])
@patch('time.time')
def test_assume_pull_data_sample_role(mock_time, calling_user):
    mock_time.return_value = time.mktime(datetime(2021, 1, 1).timetuple())
    user_id = pull_data_sample.get_hashed_and_sanitized_user_id(calling_user)
    assert user_id.get('hashed') == "3615978473146a9a3c6f21949d739f2a6ccb1d7a4f31ac0919fdac2b4560b8c2"
    assert user_id.get('sanitized') == "auth0_auth061dcd9cdc4b05c0069a392de"
    assert len(user_id.get('hashed')) == 64

@pytest.mark.parametrize("source_type", ["S3", "UPLOAD"])
@patch("awswrangler.s3")
@patch("botocore.client.BaseClient._make_api_call")
def test_pull_data_sample_s3_parquet(boto_client, s3, source_type):
    source_details = {
        "bucket": "my-test-bucket",
        "key": "some/test/key"
    }
    boto_client.side_effect = [{
        "Plaintext": json.dumps(source_details).encode('utf-8')
    }, {
        "Credentials": {
            "AccessKeyId": "TestAccessKeyId",
            "SecretAccessKey": "TestSecretAccessKey",
            "SessionToken": "TestSessionToken",
        }
    }, {
        "Contents": [{"Key": "some_file"}]
    }]
    s3.read_parquet.return_value = iter([test_df])
    s3.read_csv.side_effect = Exception()
    s3.read_json.side_effect = Exception()

    table_details = _pull_data_sample(
        source_type, source_details)['tableDetails']

    assert len(table_details) == 1
    assert table_details[0]['tableName'] == DEFAULT_DATASET_ID
    assert table_details[0]['sampleDataS3Path'].startswith(
        's3://test-temp-bucket/test-domain/test-data-product/')
    assert table_details[0]['classification'] == 'parquet'

    assert s3.to_parquet.called
    assert not s3.to_csv.called
    assert not s3.to_json.called


@pytest.mark.parametrize("source_type", ["S3", "UPLOAD"])
@patch("awswrangler.s3")
@patch("botocore.client.BaseClient._make_api_call")
def test_pull_data_sample_s3_csv(boto_client, s3, source_type):
    source_details = {
        "bucket": "my-test-bucket",
        "key": "some/test/key"
    }
    boto_client.side_effect = [{
        "Plaintext": json.dumps(source_details).encode('utf-8')
    }, {
        "Credentials": {
            "AccessKeyId": "TestAccessKeyId",
            "SecretAccessKey": "TestSecretAccessKey",
            "SessionToken": "TestSessionToken",
        }
    }, {
        "Contents": [{"Key": "some_file"}]
    }]
    s3.read_parquet.side_effect = Exception()
    s3.read_csv.return_value = iter([test_df])
    s3.read_json.side_effect = Exception()

    table_details = _pull_data_sample(
        source_type, source_details)['tableDetails']

    assert len(table_details) == 1
    assert table_details[0]['tableName'] == DEFAULT_DATASET_ID
    assert table_details[0]['sampleDataS3Path'].startswith(
        's3://test-temp-bucket/test-domain/test-data-product/')
    assert table_details[0]['classification'] == 'csv'

    assert not s3.to_parquet.called
    assert s3.to_csv.called
    assert not s3.to_json.called


@pytest.mark.parametrize("source_type", ["S3", "UPLOAD"])
@patch("awswrangler.s3")
@patch("botocore.client.BaseClient._make_api_call")
def test_pull_data_sample_s3_csv_fails_for_too_few_columns(boto_client, s3, source_type):
    source_details = {
        "bucket": "my-test-bucket",
        "key": "some/test/key"
    }
    boto_client.side_effect = [{
        "Plaintext": json.dumps(source_details).encode('utf-8')
    }, {
        "Credentials": {
            "AccessKeyId": "TestAccessKeyId",
            "SecretAccessKey": "TestSecretAccessKey",
            "SessionToken": "TestSessionToken",
        }
    }, {
        "Contents": [{"Key": "some_file"}]
    }]
    s3.read_parquet.side_effect = Exception()
    s3.read_csv.return_value = iter([pd.DataFrame(data={'single_col': [1, 2, 3, 4]})])
    s3.read_json.side_effect = Exception()

    with pytest.raises(pull_data_sample.UnsupportedSourceDataException):
        _pull_data_sample(source_type, source_details)['tableDetails']


@pytest.mark.parametrize("source_type", ["S3", "UPLOAD"])
@patch("awswrangler.s3")
@patch("botocore.client.BaseClient._make_api_call")
def test_pull_data_sample_s3_csv_fails_for_too_few_rows(boto_client, s3, source_type):
    source_details = {
        "bucket": "my-test-bucket",
        "key": "some/test/key"
    }
    boto_client.side_effect = [{
        "Plaintext": json.dumps(source_details).encode('utf-8')
    }, {
        "Credentials": {
            "AccessKeyId": "TestAccessKeyId",
            "SecretAccessKey": "TestSecretAccessKey",
            "SessionToken": "TestSessionToken",
        }
    }, {
        "Contents": [{"Key": "some_file"}]
    }]
    s3.read_parquet.side_effect = Exception()
    s3.read_csv.return_value = iter([pd.DataFrame(data={'col1': [], 'col2': [], 'col3': []})])
    s3.read_json.side_effect = Exception()

    with pytest.raises(pull_data_sample.UnsupportedSourceDataException):
        _pull_data_sample(source_type, source_details)['tableDetails']


@pytest.mark.parametrize("source_type", ["S3", "UPLOAD"])
@patch("awswrangler.s3")
@patch("botocore.client.BaseClient._make_api_call")
def test_pull_data_sample_s3_json(boto_client, s3, source_type):
    source_details = {
        "bucket": "my-test-bucket",
        "key": "some/test/key"
    }
    boto_client.side_effect = [{
        "Plaintext": json.dumps(source_details).encode('utf-8')
    }, {
        "Credentials": {
            "AccessKeyId": "TestAccessKeyId",
            "SecretAccessKey": "TestSecretAccessKey",
            "SessionToken": "TestSessionToken",
        }
    }, {
        "Contents": [{"Key": "some_file"}]
    }]
    s3.read_parquet.side_effect = Exception()
    s3.read_csv.side_effect = Exception()
    s3.read_json.return_value = iter([test_df])

    table_details = _pull_data_sample(
        source_type, source_details)['tableDetails']

    assert len(table_details) == 1
    assert table_details[0]['tableName'] == DEFAULT_DATASET_ID
    assert table_details[0]['sampleDataS3Path'].startswith(
        's3://test-temp-bucket/test-domain/test-data-product/')
    assert table_details[0]['classification'] == 'json'

    assert not s3.to_parquet.called
    assert not s3.to_csv.called
    assert s3.to_json.called


@pytest.mark.parametrize("source_type", ["S3", "UPLOAD"])
@patch("awswrangler.s3")
@patch("botocore.client.BaseClient._make_api_call")
def test_pull_data_sample_s3_csv_multiple_partitions(boto_client, s3, source_type):
    source_details = {
        "bucket": "my-test-bucket",
        "key": "some/test/key"
    }
    boto_client.side_effect = [{
        "Plaintext": json.dumps(source_details).encode('utf-8')
    }, {
        "Credentials": {
            "AccessKeyId": "TestAccessKeyId",
            "SecretAccessKey": "TestSecretAccessKey",
            "SessionToken": "TestSessionToken",
        }
    }, {
        "Contents": [
            {"Key": "some/test/key/year=2021/"},
            {"Key": "some/test/key/year=2021/file.csv"},
            {"Key": "some/test/key/year=2022/"},
            {"Key": "some/test/key/year=2022/another_file.csv"}
        ]
    }]
    s3.read_parquet.side_effect = Exception()
    s3.read_csv.return_value = iter([test_df])
    s3.read_json.side_effect = Exception()

    table_details = _pull_data_sample(
        source_type, source_details)['tableDetails']

    assert len(table_details) == 1
    assert table_details[0]['tableName'] == DEFAULT_DATASET_ID
    assert table_details[0]['sampleDataS3Path'].startswith(
        's3://test-temp-bucket/test-domain/test-data-product/')
    assert table_details[0]['classification'] == 'csv'

    assert not s3.to_parquet.called
    assert s3.to_csv.called
    assert not s3.to_json.called


@pytest.mark.parametrize("source_type", ["S3", "UPLOAD"])
@patch("awswrangler.s3")
@patch("botocore.client.BaseClient._make_api_call")
def test_pull_data_sample_s3_csv_multiple_datasets(boto_client, s3, source_type):
    source_details = {
        "bucket": "my-test-bucket",
        "key": "some/test/key"
    }
    boto_client.side_effect = [{
        "Plaintext": json.dumps(source_details).encode('utf-8')
    }, {
        "Credentials": {
            "AccessKeyId": "TestAccessKeyId",
            "SecretAccessKey": "TestSecretAccessKey",
            "SessionToken": "TestSessionToken",
        }
    }, {
        "Contents": [
            {"Key": "some/test/key/first/"},
            {"Key": "some/test/key/first/file.csv"},
            {"Key": "some/test/key/second/"},
            {"Key": "some/test/key/second/another_file.csv"}
        ]
    }]
    s3.read_parquet.side_effect = Exception()
    s3.read_csv.side_effect = [iter([test_df]), iter([test_df])]
    s3.read_json.side_effect = Exception()

    table_details = _pull_data_sample(
        source_type, source_details)['tableDetails']

    assert len(table_details) == 2
    assert table_details[0]['tableName'] == 'first'
    assert table_details[0]['originalDataS3Path'] == 's3://my-test-bucket/some/test/key/first'
    assert table_details[0]['classification'] == 'csv'
    assert table_details[1]['tableName'] == 'second'
    assert table_details[1]['originalDataS3Path'] == 's3://my-test-bucket/some/test/key/second'
    assert table_details[1]['classification'] == 'csv'

    assert not s3.to_parquet.called
    assert s3.to_csv.called
    assert not s3.to_json.called


@pytest.mark.parametrize("source_type", ["GOOGLE_ANALYTICS"])
@patch("pull_data_sample.build")
@patch("pull_data_sample.get_google_cloud_credentials")
@patch("botocore.client.BaseClient._make_api_call")
def test_google_analytics_pull_samples(boto_client, mock_ga_cred, mock_build, source_type):
    source_details = {
            "viewId": "12345678",
            "since": "2020-12-31T13:00:00.000Z",
            "until": "2021-11-16T13:00:00.000Z",
            "dimensions": "ga:userType,ga:country",
            "metrics": "ga:users",
            "projectId": "lt-demo-330100",
            "clientId": "114452300742793677110",
            "clientEmail": "sample@test.iam.gserviceaccount.example.com",
            "privateKeyId": "abcdefg",
            "privateKey": "-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----\n",
    }
    boto_client.side_effect = [{
        "Plaintext": json.dumps(source_details).encode('utf-8')
    }, {
        "Credentials": {
            "AccessKeyId": "TestAccessKeyId",
            "SecretAccessKey": "TestSecretAccessKey",
            "SessionToken": "TestSessionToken",
        }
    }, {
        "Contents": [{"Key": "some_file"}]
    }]

    mock_build.return_value.reports.return_value.batchGet.return_value.execute.return_value = {
        "reports": [
            {
                "columnHeader": {
                    "dimensions": [
                        "ga:userType"
                    ],
                    "metricHeader": {
                        "metricHeaderEntries": [
                            {
                                "name": "ga:sessions",
                                "type": "INTEGER"
                            }
                        ]
                    }
                },
                "data": {
                    "rows": [
                        {
                            "dimensions": [
                                "New Visitor"
                            ],
                            "metrics": [
                                {
                                    "values": [
                                        "12872"
                                    ]
                                }
                            ]
                        }
                    ],
                    "totals": [
                        {
                            "values": [
                                "12872"
                            ]
                        }
                    ],
                    "rowCount": 1,
                    "minimums": [
                        {
                            "values": [
                                "12872"
                            ]
                        }
                    ],
                    "maximums": [
                        {
                            "values": [
                                "12872"
                            ]
                        }
                    ],
                    "isDataGolden": True
                }
            }
        ]
    }

    table_details = _pull_data_sample(source_type, source_details)['tableDetails']
    assert len(table_details) == 1
    assert table_details[0]['tableName'] == DEFAULT_DATASET_ID
    assert table_details[0]['classification'] == 'parquet'
    assert table_details[0]['sampleDataS3Path'].startswith('s3://test-temp-bucket/test-domain/test-data-product/')


@pytest.mark.parametrize("source_type", ["GOOGLE_ANALYTICS"])
@patch("pull_data_sample.build")
@patch("pull_data_sample.get_google_cloud_credentials")
@patch("botocore.client.BaseClient._make_api_call")
def test_google_analytics_pull_samples_schedule(boto_client, mock_ga_cred, mock_build, source_type):
    source_details = {
            "viewId": "12345678",
            "since": "",
            "until": "",
            "dimensions": "ga:userType,ga:country",
            "metrics": "ga:users",
            "projectId": "lt-demo-330100",
            "clientId": "114452300742793677110",
            "clientEmail": "sample@test.iam.gserviceaccount.example.com",
            "privateKeyId": "abcdefg",
            "privateKey": "-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----\n",
    }
    boto_client.side_effect = [{
        "Plaintext": json.dumps(source_details).encode('utf-8')
    }, {
        "Credentials": {
            "AccessKeyId": "TestAccessKeyId",
            "SecretAccessKey": "TestSecretAccessKey",
            "SessionToken": "TestSessionToken",
        }
    }, {
        "Contents": [{"Key": "some_file"}]
    }]

    mock_build.return_value.reports.return_value.batchGet.return_value.execute.return_value = {
        "reports": [
            {
                "columnHeader": {
                    "dimensions": [
                        "ga:userType"
                    ],
                    "metricHeader": {
                        "metricHeaderEntries": [
                            {
                                "name": "ga:sessions",
                                "type": "INTEGER"
                            }
                        ]
                    }
                },
                "data": {
                    "rows": [
                        {
                            "dimensions": [
                                "New Visitor"
                            ],
                            "metrics": [
                                {
                                    "values": [
                                        "12872"
                                    ]
                                }
                            ]
                        }
                    ],
                    "totals": [
                        {
                            "values": [
                                "12872"
                            ]
                        }
                    ],
                    "rowCount": 1,
                    "minimums": [
                        {
                            "values": [
                                "12872"
                            ]
                        }
                    ],
                    "maximums": [
                        {
                            "values": [
                                "12872"
                            ]
                        }
                    ],
                    "isDataGolden": True
                }
            }
        ]
    }

    table_details = _pull_scheduled_data_sample(source_type, source_details)['tableDetails']
    assert len(table_details) == 1
    assert table_details[0]['tableName'] == DEFAULT_DATASET_ID
    assert table_details[0]['classification'] == 'parquet'
    assert table_details[0]['sampleDataS3Path'].startswith('s3://test-temp-bucket/test-domain/test-data-product/')

def test_google_analytics_valid_od_date_range():
    since = "2020-12-31"
    until = "2021-11-16"
    trigger_type = "ON_DEMAND"
    dateRange = pull_data_sample.get_date_range(since, until, trigger_type)
    today = datetime.utcnow().date()
    start = dateRange[0]
    end = dateRange[1]
    assert start == datetime(2020,12,31).date()
    assert end == datetime(2021,11,16).date()


def test_google_analytics_invalid_od_date_range():
    since = "2021-11-16"
    until = "2020-12-31"
    trigger_type = "ON_DEMAND"
    try:
        pull_data_sample.get_date_range(since, until, trigger_type)
    except pull_data_sample.DateRangeException as e:
        assert True

def test_google_analytics_daily_schedule_date_range():
    since = ""
    until = ""
    trigger_type = "SCHEDULE"
    schedule_rate = "rate(1 day)"
    dateRange = pull_data_sample.get_date_range(since, until, trigger_type, schedule_rate)
    today = datetime.utcnow().date()
    start = dateRange[0]
    end = dateRange[1]
    assert start == today - relativedelta(days=1)
    assert end == today

def test_google_analytics_weekly_schedule_date_range():
    since = ""
    until = ""
    trigger_type = "SCHEDULE"
    schedule_rate = "rate(1 week)"
    dateRange = pull_data_sample.get_date_range(since, until, trigger_type, schedule_rate)
    today = datetime.utcnow().date()
    start = dateRange[0]
    end = dateRange[1]
    assert start == today - relativedelta(weeks=1)
    assert end == today

def test_google_analytics_monthly_schedule_date_range():
    since = ""
    until = ""
    trigger_type = "SCHEDULE"
    schedule_rate = "rate(1 month)"
    dateRange = pull_data_sample.get_date_range(since, until, trigger_type, schedule_rate)
    today = datetime.utcnow().date()
    start = dateRange[0]
    end = dateRange[1]
    assert start == today - relativedelta(months=1)
    assert end == today

def test_from_s3_path():
    assert pull_data_sample.from_s3_path('s3://bucket/key') == {
        'bucket': 'bucket',
        'key': 'key',
    }
    assert pull_data_sample.from_s3_path('s3://bucket/multi/level/key/') == {
        'bucket': 'bucket',
        'key': 'multi/level/key/',
    }

def test_from_s3_path_fails_with_invalid_path():
    with pytest.raises(pull_data_sample.InternalError):
        pull_data_sample.from_s3_path('invalid path')


@patch("awswrangler.s3")
def test_get_csv_metadata_commas(s3):
    s3.list_objects.return_value = ['s3://bucket/key.csv']
    boto_session = MagicMock()
    s3_get_object_body = MagicMock()
    s3_get_object_body.read.return_value = b'"name","order","lightsaber_colour"\n"luke","jedi","green"\n"darth vader","sith","red"\n'
    boto_session.client.return_value.get_object.return_value = {
        'Body': s3_get_object_body
    }
    metadata = pull_data_sample.get_csv_metadata(boto_session, 's3://bucket/')
    assert metadata['delimiter'] == ','
    assert metadata['quotechar'] == '"'


@patch("awswrangler.s3")
def test_get_csv_metadata_tabs(s3):
    s3.list_objects.return_value = ['s3://bucket/key.csv']
    boto_session = MagicMock()
    s3_get_object_body = MagicMock()
    s3_get_object_body.read.return_value = b"'name'\t'order'\t'lightsaber_colour'\n'luke'\t'jedi'\t'green'\n'darth vader'\t'sith'\t'red'\n"
    boto_session.client.return_value.get_object.return_value = {
        'Body': s3_get_object_body
    }
    metadata = pull_data_sample.get_csv_metadata(boto_session, 's3://bucket/')
    assert metadata['delimiter'] == '\t'
    assert metadata['quotechar'] == "'"

def test_pd_read_json_dtypes():
    df1 = pd.read_json('{"col1":"1.0", "col2":1.0, "col3": 1}', lines=True, orient='records')
    assert df1["col1"].dtypes == int
    assert df1["col2"].dtypes == int
    assert df1["col3"].dtypes == int

    df2 = pd.read_json('{"col1":"1.0", "col2":1.0, "col3": 1}', lines=True, dtype=False, orient='records')
    assert df2["col1"].dtypes == object # object = str/mixed
    assert type(df2["col1"][0]) == str
    assert df2["col2"].dtypes == float
    assert df2["col3"].dtypes == int