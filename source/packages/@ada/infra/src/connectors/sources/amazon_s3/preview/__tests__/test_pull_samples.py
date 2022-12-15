###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import pytest
import json
from unittest.mock import patch
import pandas as pd

from handlers.common import * # NOSONAR
from handlers.sampling import * # NOSONAR
from handlers.__tests__.sampling_helpers import SamplingTestHelpers

FIXTURE_DF = pd.DataFrame(data={'col1': [1, 2], 'col2': [3, 4]})

FIXTURE_S3_PATH = 's3://test-temp-bucket/test-domain/test-data-product/'

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
    s3.read_parquet.return_value = iter([FIXTURE_DF])
    s3.read_csv.side_effect = Exception()
    s3.read_json.side_effect = Exception()

    table_details = SamplingTestHelpers.pull_data_sample(
        source_type, source_details)['tableDetails']

    assert len(table_details) == 1
    assert table_details[0]['tableName'] == DEFAULT_DATASET_ID
    assert table_details[0]['sampleDataS3Path'].startswith(FIXTURE_S3_PATH)
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
    s3.read_csv.return_value = iter([FIXTURE_DF])
    s3.read_json.side_effect = Exception()

    table_details = SamplingTestHelpers.pull_data_sample(
        source_type, source_details)['tableDetails']

    assert len(table_details) == 1
    assert table_details[0]['tableName'] == DEFAULT_DATASET_ID
    assert table_details[0]['sampleDataS3Path'].startswith(FIXTURE_S3_PATH)
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

    with pytest.raises(UnsupportedSourceDataException):
        SamplingTestHelpers.pull_data_sample(source_type, source_details)['tableDetails']


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

    with pytest.raises(UnsupportedSourceDataException):
        SamplingTestHelpers.pull_data_sample(source_type, source_details)['tableDetails']


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
    s3.read_json.return_value = iter([FIXTURE_DF])

    table_details = SamplingTestHelpers.pull_data_sample(
        source_type, source_details)['tableDetails']

    assert len(table_details) == 1
    assert table_details[0]['tableName'] == DEFAULT_DATASET_ID
    assert table_details[0]['sampleDataS3Path'].startswith(FIXTURE_S3_PATH)
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
    s3.read_csv.return_value = iter([FIXTURE_DF])
    s3.read_json.side_effect = Exception()

    table_details = SamplingTestHelpers.pull_data_sample(
        source_type, source_details)['tableDetails']

    assert len(table_details) == 1
    assert table_details[0]['tableName'] == DEFAULT_DATASET_ID
    assert table_details[0]['sampleDataS3Path'].startswith(FIXTURE_S3_PATH)
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
    s3.read_csv.side_effect = [iter([FIXTURE_DF]), iter([FIXTURE_DF])]
    s3.read_json.side_effect = Exception()

    table_details = SamplingTestHelpers.pull_data_sample(
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
