###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
###################################################################
import datetime
import boto3
import os
import pytest
from assertpy import assert_that
from dateutil import parser
from moto import mock_dynamodb, mock_s3, mock_sts
from dynamodb_data_import import DynamoDBImport, MissingParameterException, EmptyDatasetException

TEST_TABLE_NAME='testDynamoDBTable'
TEST_LAST_UPDATED_DETAILS_TABLE_NAME = 'testLastUpdateDetailsDynamoDBTable'
TEST_S3_BUCKET_NAME='ada-testing-bucket'

TEST_DATA_PRODUCT_ID='testDataProductId'
TEST_DOMAIN_ID='testDomainId'
TEST_TABLE_ARN=f"arn:aws:dynamodb:ap-southeast-2:123456789012:table/{TEST_TABLE_NAME}"
TEST_LAST_UPDATED_DETAILS_TABLE_NAME=f"arn:aws:dynamodb:ap-southeast-2:123456789012:table/{TEST_LAST_UPDATED_DETAILS_TABLE_NAME}"
TEST_CROSS_ACCOUNT_ROLE='arn:aws:iam::123456789012:role/testRole'
TEST_S3_OUTPUT_URL=f"s3://{TEST_S3_BUCKET_NAME}"
TEST_TRIGGER_TYPE='ON_DEMAND'

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
def ddb_create_last_updated_table(ddb_client):
    """Create ddb table required for testing"""
    params = {
        "TableName": TEST_LAST_UPDATED_DETAILS_TABLE_NAME,
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
def ddb_create_test_table(ddb_client):
    """Create ddb table required for testing"""
    params = {
        "TableName": TEST_TABLE_NAME,
        "KeySchema": [
            {"AttributeName": "id", "KeyType": "HASH"},
        ],
        "AttributeDefinitions": [
            {"AttributeName": "id", "AttributeType": "S"},
        ],
        "BillingMode": "PAY_PER_REQUEST",
    }
    ddb_client.create_table(**params)
    yield

@pytest.fixture
def ddb_insert_test_data(ddb_client, ddb_create_test_table):
    """Insert test data required for testing"""
    params = {
        "TableName": TEST_TABLE_NAME,
        "Item": 
            {
                "id": {
                    "S": "1"
                },
                "name": {
                    "S": "Test1"
                },
                "data": {
                    "S": "Data1"
                }
            }
    }
    ddb_client.put_item(**params)
    yield

@pytest.fixture
def ddb_insert_test_data_large_dataset(ddb_client, ddb_create_test_table):
    """Insert test data required for testing"""

    array_requests = range(1, 11)
    for index_array_requests in array_requests:
        params = {
            'RequestItems': {
                TEST_TABLE_NAME: [
                ]
            }
        }
        array_put_request = range(1, 26)
        
        for n in array_put_request:
            params['RequestItems'][TEST_TABLE_NAME].append({
                "PutRequest": {
                    "Item": {
                        "id": {
                            "S": f"{index_array_requests * 25 + n}"
                        },
                        "name": {
                            "S": f"Name{index_array_requests * 25 + n}"
                        },
                        "data": {
                            "S": f"Data{index_array_requests * 25 + n}"
                        }
                    }
                }
            })
        
        ddb_client.batch_write_item(**params)

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
        Bucket=TEST_S3_BUCKET_NAME,
        CreateBucketConfiguration={"LocationConstraint": "ap-southeast-2"},
    )
    yield

def test_data_imports_correctly(ddb_client, ddb_create_last_updated_table, ddb_create_test_table, ddb_insert_test_data, s3_client, s3_create): 
    dynamoDBImport = DynamoDBImport(
            TEST_TABLE_ARN,
            "",
            TEST_S3_OUTPUT_URL,
            TEST_LAST_UPDATED_DETAILS_TABLE_NAME,
            TEST_DATA_PRODUCT_ID,
            TEST_DOMAIN_ID,
            TEST_TRIGGER_TYPE
        )
    dynamoDBImport.execute()

    response = s3_client.list_objects_v2(
        Bucket=TEST_S3_BUCKET_NAME
    )
    assert_that(response["KeyCount"]).is_equal_to(1)

    response = ddb_client.get_item(
        Key={"dataProductId": {"S": TEST_DATA_PRODUCT_ID}, "domainId": {"S": TEST_DOMAIN_ID}},
        TableName=TEST_LAST_UPDATED_DETAILS_TABLE_NAME,
    )
    assert_that(parser.parse(response["Item"]["timestamp"]["S"])).is_type_of(
        datetime.datetime
    )
    assert_that(response["Item"]["num_rows"]["S"]).is_equal_to('1')

def test_cross_account_data_imports_correctly(ddb_client, sts_client, ddb_create_last_updated_table, ddb_create_test_table, ddb_insert_test_data, s3_client, s3_create): 
    dynamoDBImport = DynamoDBImport(
            TEST_TABLE_ARN,
            TEST_CROSS_ACCOUNT_ROLE,
            TEST_S3_OUTPUT_URL,
            TEST_LAST_UPDATED_DETAILS_TABLE_NAME,
            TEST_DATA_PRODUCT_ID,
            TEST_DOMAIN_ID,
            TEST_TRIGGER_TYPE
        )
    dynamoDBImport.execute()

    response = s3_client.list_objects_v2(
        Bucket=TEST_S3_BUCKET_NAME
    )

    assert_that(response["KeyCount"]).is_equal_to(1)

    response = ddb_client.get_item(
        Key={"dataProductId": {"S": TEST_DATA_PRODUCT_ID}, "domainId": {"S": TEST_DOMAIN_ID}},
        TableName=TEST_LAST_UPDATED_DETAILS_TABLE_NAME,
    )
    assert_that(parser.parse(response["Item"]["timestamp"]["S"])).is_type_of(
        datetime.datetime
    )

def test_data_imports_large_dataset_correctly(ddb_client, ddb_create_last_updated_table, ddb_create_test_table, ddb_insert_test_data_large_dataset, s3_client, s3_create): 
    dynamoDBImport = DynamoDBImport(
            TEST_TABLE_ARN,
            "",
            TEST_S3_OUTPUT_URL,
            TEST_LAST_UPDATED_DETAILS_TABLE_NAME,
            TEST_DATA_PRODUCT_ID,
            TEST_DOMAIN_ID,
            TEST_TRIGGER_TYPE
        )
    dynamoDBImport.execute()

    response = s3_client.list_objects_v2(
        Bucket=TEST_S3_BUCKET_NAME
    )
    assert_that(response["KeyCount"]).is_equal_to(1)

    response = ddb_client.get_item(
        Key={"dataProductId": {"S": TEST_DATA_PRODUCT_ID}, "domainId": {"S": TEST_DOMAIN_ID}},
        TableName=TEST_LAST_UPDATED_DETAILS_TABLE_NAME,
    )
    assert_that(parser.parse(response["Item"]["timestamp"]["S"])).is_type_of(
        datetime.datetime
    )
    assert_that(response["Item"]["num_rows"]["S"]).is_equal_to(str(10*25))

def test_data_imports_no_data_raises_exception(ddb_client, ddb_create_last_updated_table, ddb_create_test_table, s3_client, s3_create): 
    with pytest.raises(EmptyDatasetException):
        dynamoDBImport = DynamoDBImport(
                TEST_TABLE_ARN,
                "",
                TEST_S3_OUTPUT_URL,
                TEST_LAST_UPDATED_DETAILS_TABLE_NAME,
                TEST_DATA_PRODUCT_ID,
                TEST_DOMAIN_ID,
                TEST_TRIGGER_TYPE
            )
        dynamoDBImport.execute()

def test_missing_table_arn_raises_exception():
    with pytest.raises(MissingParameterException):
        dynamoDBImport = DynamoDBImport(
            "",
            TEST_CROSS_ACCOUNT_ROLE,
            TEST_S3_OUTPUT_URL,
            TEST_LAST_UPDATED_DETAILS_TABLE_NAME,
            TEST_DATA_PRODUCT_ID,
            TEST_DOMAIN_ID,
            TEST_TRIGGER_TYPE
        )
        dynamoDBImport.execute()

def test_missing_data_product_id_raises_exception():
    with pytest.raises(MissingParameterException):
        dynamoDBImport = DynamoDBImport(
            TEST_TABLE_ARN,
            TEST_CROSS_ACCOUNT_ROLE,
            TEST_S3_OUTPUT_URL,
            TEST_LAST_UPDATED_DETAILS_TABLE_NAME,
            "",
            TEST_DOMAIN_ID,
            TEST_TRIGGER_TYPE
        )
        dynamoDBImport.execute()

def test_missing_domain_id_raises_exception():
    with pytest.raises(MissingParameterException):
        dynamoDBImport = DynamoDBImport(
            TEST_TABLE_ARN,
            TEST_CROSS_ACCOUNT_ROLE,
            TEST_S3_OUTPUT_URL,
            TEST_LAST_UPDATED_DETAILS_TABLE_NAME,
            TEST_DATA_PRODUCT_ID,
            "",
            TEST_TRIGGER_TYPE
        )
        dynamoDBImport.execute()

def test_missing_trigger_type_raises_exception():
    with pytest.raises(MissingParameterException):
        dynamoDBImport = DynamoDBImport(
            TEST_TABLE_ARN,
            TEST_CROSS_ACCOUNT_ROLE,
            TEST_S3_OUTPUT_URL,
            TEST_LAST_UPDATED_DETAILS_TABLE_NAME,
            TEST_DATA_PRODUCT_ID,
            TEST_DOMAIN_ID,
            ""
        )
        dynamoDBImport.execute()

def test_missing_last_updated_table_name_raises_exception():
    with pytest.raises(MissingParameterException):
        dynamoDBImport = DynamoDBImport(
            TEST_TABLE_ARN,
            TEST_CROSS_ACCOUNT_ROLE,
            TEST_S3_OUTPUT_URL,
            "",
            TEST_DATA_PRODUCT_ID,
            TEST_DOMAIN_ID,
            TEST_TRIGGER_TYPE
        )
        dynamoDBImport.execute()

def test_missing_s3_output_uri_raises_exception():
    with pytest.raises(MissingParameterException):
        dynamoDBImport = DynamoDBImport(
            TEST_TABLE_ARN,
            TEST_CROSS_ACCOUNT_ROLE,
            "",
            TEST_LAST_UPDATED_DETAILS_TABLE_NAME,
            TEST_DATA_PRODUCT_ID,
            TEST_DOMAIN_ID,
            TEST_TRIGGER_TYPE
        )
        dynamoDBImport.execute()
