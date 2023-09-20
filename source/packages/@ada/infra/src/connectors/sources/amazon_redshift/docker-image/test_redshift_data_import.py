###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
from datetime import datetime
import boto3
from botocore.stub import Stubber
import os

from moto import mock_dynamodb, mock_s3, mock_sts
from unittest.mock import MagicMock
import pytest
import pandas as pd
from assertpy import assert_that
from dateutil import parser
from redshift_data_import import RedshiftImport, MissingParameterException

_TABLE_NAME = "lastupdatedtable"

_DATA_PRODUCT_ID = "dataproduct3"
_DOMAIN_ID = "domain3"
_DATABASE_NAME = 'dev'
_USERNAME='awsuser'
_CLUSETR_IDENTIFIER='test-redshift-cluster'
_WORKGROUP = 'default'
_TEST_DATETIME = datetime(2000, 1, 1)

_TEST_DATA = pd.DataFrame({
    'Column1': ['11', '21'],
    'Column2': ['12', '22']
})

@pytest.fixture
def boto3_redshift_serverless_client():
    client = boto3.client('redshift-serverless')
    stubber = Stubber(client)
    expected_params = {
        "dbName": _DATABASE_NAME,
        "durationSeconds": 3600,
        "workgroupName": _WORKGROUP
     }
    stubber.add_response('get_credentials', {
        "dbUser": "username",
        "dbPassword": "password"
    }, expected_params)
    stubber.activate()
    return client

@pytest.fixture
def boto3_redshift_cluster_client():
    client = boto3.client('redshift')
    stubber = Stubber(client)
    expected_params = {
        "DbUser": _USERNAME,
        "DbName": _DATABASE_NAME,
        "ClusterIdentifier": _CLUSETR_IDENTIFIER,
        "AutoCreate": False,
        "DurationSeconds": 3600
     }
    stubber.add_response('get_cluster_credentials', {
        "DbUser": "username",
        "DbPassword": "password"
    }, expected_params)
    stubber.activate()
    return client

@pytest.fixture
def boto3_ddb_client():
    client = boto3.client('dynamodb')
    stubber = Stubber(client)
    expected_params = {
        "TableName": _TABLE_NAME,
        "Item": {
            "dataProductId": {"S": _DATA_PRODUCT_ID},
            "domainId": {"S": _DOMAIN_ID},
            "timestamp": {"S": '2000-01-01-00-00-00'},
            "num_rows": {"S": '2'},
        }
    }
    stubber.add_response('put_item', {}, expected_params)
    stubber.activate()
    return client

@pytest.fixture
def boto3_sts_client():
    client = boto3.client('sts')
    stubber = Stubber(client)
    stubber.activate()
    return client  

@pytest.fixture
def redshift_connection():
    mock_conn = MagicMock()
    mock_cursor = mock_conn.__enter__.return_value.cursor.return_value
    mock_cursor.__enter__.return_value.execute.return_value = None
    mock_cursor.__enter__.return_value.fetch_dataframe.return_value = _TEST_DATA
    return mock_conn
    
def test_ondemand_data_import_with_redshift_serverless(
    mocker, boto3_redshift_serverless_client, boto3_ddb_client, boto3_sts_client, redshift_connection
):
    mocker.patch("redshift_data_import.boto3.client", side_effect=[boto3_ddb_client, boto3_sts_client, boto3_redshift_serverless_client])
    mocker.patch("redshift_data_import.redshift_connector.connect").return_value = redshift_connection
    mocker.patch("redshift_data_import.wr.s3.to_parquet")
    mocker.patch("redshift_data_import.datetime").now.return_value = _TEST_DATETIME
    redshift = RedshiftImport(
            "default.123456789012.us-east-1.redshift-serverless.amazonaws.com",
            "5439",
            _DATABASE_NAME,
            "sample_data_dev",
            "Serverless",
            _WORKGROUP,
            "",
            "",
            "",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            _DATA_PRODUCT_ID,
            _DOMAIN_ID,
            "SCHEDULE"
        )
    redshift.execute()

def test_ondemand_data_import_with_redshift_cluster(
    mocker, boto3_redshift_cluster_client, boto3_ddb_client, boto3_sts_client, redshift_connection
):
    mocker.patch("redshift_data_import.boto3.client", side_effect=[boto3_ddb_client, boto3_sts_client, boto3_redshift_cluster_client])
    mocker.patch("redshift_data_import.redshift_connector.connect").return_value = redshift_connection
    mocker.patch("redshift_data_import.wr.s3.to_parquet")
    mocker.patch("redshift_data_import.datetime").now.return_value = _TEST_DATETIME

    redshift = RedshiftImport(
            "test-redshift-cluster.c9reiliclukz.us-east-1.redshift.amazonaws.com",
            "5439",
            _DATABASE_NAME,
            "sample_data_dev",
            "Cluster",
            "",
            _USERNAME,
            _CLUSETR_IDENTIFIER,
            "",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            _DATA_PRODUCT_ID,
            _DOMAIN_ID,
            "SCHEDULE"
        )
    redshift.execute()

def test_missing_database_endpoint_raises_exception():
    with pytest.raises(MissingParameterException):
        redshift = RedshiftImport(
            "",
            "5439",
            _DATABASE_NAME,
            "sample_data_dev",
            "Serverless",
            _WORKGROUP,
            "",
            "",
            "",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            "dataproduct1",
            "domain1",
            "SCHEDULE"
        )
        redshift.execute()

def test_missing_database_port_raises_exception():
    with pytest.raises(MissingParameterException):
        redshift = RedshiftImport(
            "default.123456789012.us-east-1.redshift-serverless.amazonaws.com",
            "",
            _DATABASE_NAME,
            "sample_data_dev",
            "Serverless",
            _WORKGROUP,
            "",
            "",
            "arn:aws:iam::111111111111:role/xacctrole",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            "dataproduct1",
            "domain1",
            "SCHEDULE"
        )
        redshift.execute()

def test_missing_database_name_raises_exception():
    with pytest.raises(MissingParameterException):
        redshift = RedshiftImport(
            "default.123456789012.us-east-1.redshift-serverless.amazonaws.com",
            "5439",
            "",
            "sample_data_dev",
            "Serverless",
            _WORKGROUP,
            "",
            "",
            "arn:aws:iam::111111111111:role/xacctrole",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            "dataproduct1",
            "domain1",
            "SCHEDULE"
        )
        redshift.execute()

def test_missing_database_table_raises_exception():
    with pytest.raises(MissingParameterException):
        redshift = RedshiftImport(
            "default.123456789012.us-east-1.redshift-serverless.amazonaws.com",
            "5439",
            _DATABASE_NAME,
            "",
            "Serverless",
            _WORKGROUP,
            "",
            "",
            "arn:aws:iam::111111111111:role/xacctrole",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            "dataproduct1",
            "domain1",
            "SCHEDULE"
        )
        redshift.execute()

def test_missing_database_type_serverless_raises_exception():
    with pytest.raises(MissingParameterException):
        redshift = RedshiftImport(
            "default.123456789012.us-east-1.redshift-serverless.amazonaws.com",
            "5439",
            _DATABASE_NAME,
            "sample_data_dev",
            "",
            "",
            "",
            "",
            "arn:aws:iam::111111111111:role/xacctrole",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            "dataproduct1",
            "domain1",
            "SCHEDULE"
        )
        redshift.execute()

def test_missing_database_type_cluster_raises_exception():
    with pytest.raises(MissingParameterException):
        redshift = RedshiftImport(
            "test-redshift-cluster.c9reiliclukz.us-east-1.redshift.amazonaws.com",
            "5439",
            _DATABASE_NAME,
            "sample_data_dev",
            "Cluster",
            _WORKGROUP,
            "",
            "",
            "arn:aws:iam::111111111111:role/xacctrole",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            "dataproduct1",
            "domain1",
            "SCHEDULE"
        )
        redshift.execute()

def test_missing_s3_output_uri_raises_exception():
    with pytest.raises(MissingParameterException):
        redshift = RedshiftImport(
            "default.123456789012.us-east-1.redshift-serverless.amazonaws.com",
            "5439",
            _DATABASE_NAME,
            "sample_data_dev",
            "Serverless",
            _WORKGROUP,
            "",
            "",
            "arn:aws:iam::111111111111:role/xacctrole",
            "",
            _TABLE_NAME,
            "dataproduct1",
            "domain1",
            "SCHEDULE"
        )
        redshift.execute()

def test_missing_table_name_raises_exception():
    with pytest.raises(MissingParameterException):
        redshift = RedshiftImport(
            "default.123456789012.us-east-1.redshift-serverless.amazonaws.com",
            "5439",
            _DATABASE_NAME,
            "sample_data_dev",
            "Serverless",
            _WORKGROUP,
            "",
            "",
            "arn:aws:iam::111111111111:role/xacctrole",
            "s3://ada-testing-bucket",
            "",
            "dataproduct1",
            "domain1",
            "SCHEDULE"
        )
        redshift.execute()

def test_missing_domain_id_raises_exception():
    with pytest.raises(MissingParameterException):
        redshift = RedshiftImport(
            "default.123456789012.us-east-1.redshift-serverless.amazonaws.com",
            "5439",
            _DATABASE_NAME,
            "sample_data_dev",
            "Serverless",
            _WORKGROUP,
            "",
            "",
            "arn:aws:iam::111111111111:role/xacctrole",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            "dataproduct1",
            "",
            "SCHEDULE"
        )
        redshift.execute()

def test_missing_data_product_id_raises_exception():
    with pytest.raises(MissingParameterException):
        redshift = RedshiftImport(
            "default.123456789012.us-east-1.redshift-serverless.amazonaws.com",
            "5439",
            _DATABASE_NAME,
            "sample_data_dev",
            "Serverless",
            _WORKGROUP,
            "",
            "",
            "arn:aws:iam::111111111111:role/xacctrole",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            "",
            "domain1",
            "SCHEDULE"
        )
        redshift.execute()

def test_missing_trigger_type_raises_exception():
    with pytest.raises(MissingParameterException):
        redshift = RedshiftImport(
            "default.123456789012.us-east-1.redshift-serverless.amazonaws.com",
            "5439",
            "",
            "sample_data_dev",
            "Serverless",
            _WORKGROUP,
            "",
            "",
            "arn:aws:iam::111111111111:role/xacctrole",
            "s3://ada-testing-bucket",
            _TABLE_NAME,
            "dataproduct1",
            "domain1",
            "",
        )
        redshift.execute()
