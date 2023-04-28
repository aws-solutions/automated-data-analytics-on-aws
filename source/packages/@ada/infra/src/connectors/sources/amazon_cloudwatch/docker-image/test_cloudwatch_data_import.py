###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import datetime
import boto3
import os
from moto import mock_dynamodb, mock_s3, mock_sts
import pytest
import pandas as pd
from assertpy import assert_that
from dateutil import parser
from cloudwatch_data_import import CloudWatchImport, DateRangeException, MissingParameterException

_TABLE_NAME = "lastupdatedtable"


@pytest.fixture
def aws_credentials():
    """Mocked AWS Credentials for moto."""
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_SECURITY_TOKEN"] = "testing"
    os.environ["AWS_SESSION_TOKEN"] = "testing"
    os.environ["AWS_DEFAULT_REGION"] = "ap-southeast-2"


@pytest.fixture
def ddb_client(aws_credentials):
    """Create mock ddb client"""
    with mock_dynamodb():
        conn = boto3.client("dynamodb", region_name="ap-southeast-2")
        yield conn


@pytest.fixture
def ddb_create(ddb_client):
    """Create ddb table required for testing"""
    params = {
        "TableName": _TABLE_NAME,
        "KeySchema": [
            {"AttributeName": "dataProductId", "KeyType": "HASH"},
            {"AttributeName": "domainId", "KeyType": "RANGE"},
        ],
        "AttributeDefinitions": [
            {"AttributeName": "dataProductId", "AttributeType": "S"},
            {"AttributeName": "domainId", "AttributeType": "S"},
        ],
        "BillingMode": "PAY_PER_REQUEST",
    }
    ddb_client.create_table(**params)
    yield


@pytest.fixture
def s3_client(aws_credentials):
    """Create mock s3 client"""
    with mock_s3():
        conn = boto3.client("s3", region_name="ap-southeast-2")
        yield conn


@pytest.fixture
def sts_client(aws_credentials):
    """Create mock sts client"""
    with mock_sts():
        conn = boto3.client("sts", region_name="ap-southeast-2")
        yield conn


@pytest.fixture
def s3_create(s3_client):
    """Create s3 bucket required for testing"""
    s3_client.create_bucket(
        Bucket="ada-testing-bucket",
        CreateBucketConfiguration={"LocationConstraint": "ap-southeast-2"},
    )
    yield


@pytest.fixture
def pd_data():
    """Mock CloudWatch return data"""
    return {
        "timestamp": [
            "2022-12-09 00:15:12.267",
            "2022-12-08 22:39:08.445",
            "2022-12-08 15:16:14.981",
            "2022-12-08 14:48:38.473",
        ],
        "message": [
            "[0%] start: Building and publishing c21243e1b8",
            "ada-dp-9192-cw-no-5191-071f: creating Cloudwatch",
            "Changeset arn:aws:cloudformation:ap-southeast-2",
            "[100%] success: Built and published c21243e1b8",
        ],
        "ptr": [
            "CpcBClwKWDExODE3NjIzMzI4ODovYXdzL2xhbWJkYS9BZG",
            "CpcBClwKWDExODE3NjIzMzI4ODovYXdzL2xhbWJkYS9BZG",
            "CpcBClwKWDExODE3NjIzMzI4ODovYXdzL2xhbWJkYS9BZG",
            "CpcBClwKWDExODE3NjIzMzI4ODovYXdzL2xhbWJkYS9BZG",
        ],
    }


def test_schedule_data_import_without_last_updated_timestamp(
    pd_data, mocker, ddb_client, ddb_create, s3_create, s3_client
):
    mocker.patch("awswrangler.cloudwatch.read_logs", return_value=pd.DataFrame(pd_data))
    cw = CloudWatchImport(
        "ADA-CLOUDWATCH_TESTING",
        "query",
        "10/05/2022",
        "",
        "s3://ada-testing-bucket",
        _TABLE_NAME,
        "dataproduct1",
        "domain1",
        "SCHEDULE",
        "",
    )
    cw.execute()

    # check that the data file has been written
    response = s3_client.list_objects_v2(
        Bucket="ada-testing-bucket",
    )
    assert_that(response["KeyCount"]).is_equal_to(1)

    # check that ddb lastUpdatedTime has been written
    response = ddb_client.get_item(
        Key={"dataProductId": {"S": "dataproduct1"}, "domainId": {"S": "domain1"}},
        TableName="lastupdatedtable",
    )
    assert_that(parser.parse(response["Item"]["timestamp"]["S"])).is_type_of(
        datetime.datetime
    )


def test_schedule_data_import_with_last_updated_timestamp(
    mocker, pd_data, s3_client, s3_create, ddb_client, ddb_create
):
    data_product_id = "dataproduct2"
    domain_id = "domain2"
    timestamp = "01/11/2023, 01:48"

    ddb_client.put_item(
        TableName=_TABLE_NAME,
        Item={
            "dataProductId": {"S": data_product_id},
            "domainId": {"S": domain_id},
            "timestamp": {"S": timestamp},
            "num_rows": {"S": str(3)},
        },
    )

    mocker.patch("awswrangler.cloudwatch.read_logs", return_value=pd.DataFrame(pd_data))
    cw = CloudWatchImport(
        "ADA-CLOUDWATCH_TESTING",
        "query",
        "10/05/2022",
        "",
        "s3://ada-testing-bucket",
        _TABLE_NAME,
        data_product_id,
        domain_id,
        "SCHEDULE",
        "",
    )
    cw.execute()

    # check that the data file has been written
    response = s3_client.list_objects_v2(
        Bucket="ada-testing-bucket",
    )
    assert_that(response["KeyCount"]).is_equal_to(1)

    # check that ddb lastUpdatedTime has been written
    response = ddb_client.get_item(
        Key={"dataProductId": {"S": data_product_id}, "domainId": {"S": domain_id}},
        TableName=_TABLE_NAME,
    )
    assert_that(parser.parse(response["Item"]["timestamp"]["S"])).is_type_of(
        datetime.datetime
    )


def test_ondemand_data_import_with_date_range(
    mocker, pd_data, s3_client, s3_create, ddb_client, ddb_create
):
    data_product_id = "dataproduct3"
    domain_id = "domain3"

    mocker.patch("awswrangler.cloudwatch.read_logs", return_value=pd.DataFrame(pd_data))
    cw = CloudWatchImport(
        "ADA-CLOUDWATCH_TESTING",
        "query",
        "10/05/2022",
        "10/06/2022",
        "s3://ada-testing-bucket",
        _TABLE_NAME,
        data_product_id,
        domain_id,
        "ON_DEMAND",
        "",
    )
    cw.execute()

    # check that the data file has been written
    response = s3_client.list_objects_v2(
        Bucket="ada-testing-bucket",
    )
    assert_that(response["KeyCount"]).is_equal_to(1)

    # check that ddb lastUpdatedTime has been written
    response = ddb_client.get_item(
        Key={"dataProductId": {"S": data_product_id}, "domainId": {"S": domain_id}},
        TableName=_TABLE_NAME,
    )
    assert_that(parser.parse(response["Item"]["timestamp"]["S"])).is_type_of(
        datetime.datetime
    )


def test_invalid_date_range_raises_exception():
    with pytest.raises(DateRangeException):
        cw = CloudWatchImport(
            "ADA-CLOUDWATCH_TESTING",
            "query",
            "10/07/2022",
            "10/06/2022",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            "data_product_id",
            "domain_id",
            "ON_DEMAND",
            "",
        )
        cw.execute()


def test_invalid_timestamp_format_raises_exception(ddb_client, ddb_create):
    data_product_id = "dataproduct3"
    domain_id = "domain3"
    timestamp = "incorrecttimestamp"

    ddb_client.put_item(
        TableName=_TABLE_NAME,
        Item={
            "dataProductId": {"S": data_product_id},
            "domainId": {"S": domain_id},
            "timestamp": {"S": timestamp},
            "num_rows": {"S": str(3)},
        },
    )
    with pytest.raises(DateRangeException):
        cw = CloudWatchImport(
            "ADA-CLOUDWATCH_TESTING",
            "query",
            "10/07/2022",
            "",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            data_product_id,
            domain_id,
            "SCHEDULE",
            "",
        )
        cw.execute()


def test_empty_data_query_writes_no_data(
    pd_data, mocker, ddb_client, ddb_create, s3_create, s3_client
):

    mocker.patch("awswrangler.cloudwatch.read_logs", return_value=pd.DataFrame())
    cw = CloudWatchImport(
        "ADA-CLOUDWATCH_TESTING",
        "query",
        "10/05/2022",
        "",
        "s3://ada-testing-bucket",
        _TABLE_NAME,
        "dataproduct1",
        "domain1",
        "SCHEDULE",
        "",
    )
    cw.execute()

    # check that the data file has been written
    response = s3_client.list_objects_v2(
        Bucket="ada-testing-bucket",
    )
    assert_that(response["KeyCount"]).is_equal_to(0)


def test_cross_account_data_imports_correctly(
    pd_data, mocker, ddb_client, ddb_create, s3_create, s3_client, sts_client
):

    mocker.patch("awswrangler.cloudwatch.read_logs", return_value=pd.DataFrame(pd_data))
    cw = CloudWatchImport(
        "ADA-CLOUDWATCH_TESTING",
        "query",
        "10/05/2022",
        "",
        "s3://ada-testing-bucket",
        _TABLE_NAME,
        "dataproduct1",
        "domain1",
        "SCHEDULE",
        "arn:aws:iam::111111111111:role/xacctrole",
    )
    cw.execute()

    # check that the data file has been written
    response = s3_client.list_objects_v2(
        Bucket="ada-testing-bucket",
    )
    assert_that(response["KeyCount"]).is_equal_to(1)

    # check that ddb lastUpdatedTime has been written
    response = ddb_client.get_item(
        Key={"dataProductId": {"S": "dataproduct1"}, "domainId": {"S": "domain1"}},
        TableName="lastupdatedtable",
    )
    assert_that(parser.parse(response["Item"]["timestamp"]["S"])).is_type_of(
        datetime.datetime
    )


def test_missing_cw_log_name_raises_exception():
    with pytest.raises(MissingParameterException):
        cw = CloudWatchImport(
            "",
            "query",
            "10/05/2022",
            "",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            "dataproduct1",
            "domain1",
            "SCHEDULE",
            "arn:aws:iam::111111111111:role/xacctrole",
        )
        cw.execute()


def test_missing_query_raises_exception():
    with pytest.raises(MissingParameterException):
        cw = CloudWatchImport(
            "ADA-CLOUDWATCH_TESTING",
            "",
            "10/05/2022",
            "",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            "dataproduct1",
            "domain1",
            "SCHEDULE",
            "arn:aws:iam::111111111111:role/xacctrole",
        )
        cw.execute()


def test_missing_s3_output_uri_raises_exception():
    with pytest.raises(MissingParameterException):
        cw = CloudWatchImport(
            "ADA-CLOUDWATCH_TESTING",
            "query",
            "10/05/2022",
            "",
            "",
            _TABLE_NAME,
            "dataproduct1",
            "domain1",
            "SCHEDULE",
            "arn:aws:iam::111111111111:role/xacctrole",
        )
        cw.execute()


def test_missing_data_product_id_raises_exception():
    with pytest.raises(MissingParameterException):
        cw = CloudWatchImport(
            "ADA-CLOUDWATCH_TESTING",
            "query",
            "10/05/2022",
            "",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            "",
            "domain1",
            "SCHEDULE",
            "arn:aws:iam::111111111111:role/xacctrole",
        )
        cw.execute()


def test_missing_table_name_raises_exception():
    with pytest.raises(MissingParameterException):
        cw = CloudWatchImport(
            "ADA-CLOUDWATCH_TESTING",
            "query",
            "10/05/2022",
            "",
            "s3://ada-testing-bucket",
            "",
            "dataproduct1",
            "domain1",
            "SCHEDULE",
            "arn:aws:iam::111111111111:role/xacctrole",
        )
        cw.execute()


def test_missing_domain_id_raises_exception():
    with pytest.raises(MissingParameterException):
        cw = CloudWatchImport(
            "ADA-CLOUDWATCH_TESTING",
            "query",
            "10/05/2022",
            "",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            "dataproduct1",
            "",
            "SCHEDULE",
            "arn:aws:iam::111111111111:role/xacctrole",
        )
        cw.execute()


def test_missing_trigger_type_raises_exception():
    with pytest.raises(MissingParameterException):
        cw = CloudWatchImport(
            "ADA-CLOUDWATCH_TESTING",
            "query",
            "10/05/2022",
            "",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            "dataproduct1",
            "domain1",
            "",
            "arn:aws:iam::111111111111:role/xacctrole",
        )
        cw.execute()


def test_incorrect_since_date_raises_exception():
    with pytest.raises(DateRangeException):
        cw = CloudWatchImport(
            "ADA-CLOUDWATCH_TESTING",
            "query",
            "",
            "",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            "dataproduct1",
            "domain1",
            "SCHEDULE",
            "arn:aws:iam::111111111111:role/xacctrole",
        )
        cw.execute()
