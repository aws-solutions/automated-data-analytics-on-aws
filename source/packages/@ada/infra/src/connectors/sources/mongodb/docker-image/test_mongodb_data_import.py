import datetime
import boto3
import os
from mongomock import Database, MongoClient
from moto import mock_dynamodb, mock_s3, mock_sts, mock_secretsmanager
import pytest
import pandas as pd
from assertpy import assert_that
from dateutil import parser
from mongodb_data_import import CADownloaderException, MissingParameterException, MongoDBImport

DB_ENDPOINT = 'localhost'
DB_PORT = '27017'
DB_NAME = 'ada-test-db'
COLLECTION_NAME = 'zips'
USERNAME = 'username'
PASSWORD = 'passwordsecretid'
TABLE_NAME = 'lastupdatedtable'
DOMAIN_ID = 'ada-test-domain'
DATA_PRODUCT_ID = 'ada-data-product'
S3_OUTPUT_BUCKET_URI = 's3://ada-testing-bucket'
TRIGGER_TYPE = 'ON_DEMAND'
SCHEDULE_RATE = 'NONE'
TLS = "False"
TLS_CA = "https://cacert.pem"
TLS_CA_S3 = "s3://certs/cacert.pem"
TLS_CLIENT_CERT_ID = "tlsclientsecretid"
EXTRA_PARAMS = os.environ.get("EXTRA_PARAMS")
INCREMENT_UPDATE_COLUMN = os.environ.get("INCREMENT_UPDATE_COLUMN")
BOOKMARK_FIELD = os.environ.get("BOOKMARK_FIELD")
BOOKMARK_FIELD_TYPE = os.environ.get("BOOKMARK_FIELD_TYPE")

@pytest.fixture
def aws_credentials():
    """Mocked AWS Credentials for moto."""
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_SECURITY_TOKEN"] = "testing"
    os.environ["AWS_SESSION_TOKEN"] = "testing"


@pytest.fixture
def ddb_client(aws_credentials):
    with mock_dynamodb():
        conn = boto3.client('dynamodb', region_name='ap-southeast-2')
        yield conn


@pytest.fixture
def ddb_create(ddb_client):
    params = {
        'TableName': TABLE_NAME,
        'KeySchema': [
            {'AttributeName': 'dataProductId', 'KeyType': 'HASH'},
            {'AttributeName': 'domainId', 'KeyType': 'RANGE'}
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'dataProductId', 'AttributeType': 'S'},
            {'AttributeName': 'domainId', 'AttributeType': 'S'}
        ],
        'BillingMode': 'PAY_PER_REQUEST'
    }
    ddb_client.create_table(**params)
    yield


@pytest.fixture
def s3_client(aws_credentials):
    with mock_s3():
        conn = boto3.client('s3', region_name='ap-southeast-2')
        yield conn


@pytest.fixture
def sts_client(aws_credentials):
    with mock_sts():
        conn = boto3.client('sts', region_name='ap-southeast-2')
        yield conn


@pytest.fixture
def s3_create(s3_client):
    s3_client.create_bucket(
        Bucket='ada-testing-bucket',
        CreateBucketConfiguration={'LocationConstraint': 'ap-southeast-2'})
    s3_client.create_bucket(
        Bucket='certs',
        CreateBucketConfiguration={'LocationConstraint': 'ap-southeast-2'})
    
    s3_client.put_object(Body=b'test data', Bucket='certs', Key='cacert.pem')
    yield


@pytest.fixture
def sm_client(aws_credentials):
    with mock_secretsmanager():
        conn = boto3.client('secretsmanager', region_name='ap-southeast-2')
        yield conn


@pytest.fixture
def sm_create(sm_client):
    sm_client.create_secret(Name=PASSWORD, SecretString="password")
    sm_client.create_secret(Name=TLS_CLIENT_CERT_ID, SecretString="tls_client_cert")
    yield


@pytest.fixture
def pd_data():
    return {
        'timestamp': ['2022-12-09 00:15:12.267', '2022-12-08 22:39:08.445',
                      '2022-12-08 15:16:14.981', '2022-12-08 14:48:38.473'],
        'message': ['[0%] start: Building and publishing c21243e1b8',
                    'ada-dp-9192-cw-no-5191-071f: creating Cloudwatch',
                    'Changeset arn:aws:cloudformation:ap-southeast-2',
                    '[100%] success: Built and published c21243e1b8'],
        'ptr': ['CpcBClwKWDExODE3NjIzMzI4ODovYXdzL2xhbWJkYS9BZG',
                'CpcBClwKWDExODE3NjIzMzI4ODovYXdzL2xhbWJkYS9BZG',
                'CpcBClwKWDExODE3NjIzMzI4ODovYXdzL2xhbWJkYS9BZG',
                'CpcBClwKWDExODE3NjIzMzI4ODovYXdzL2xhbWJkYS9BZG']
    }


@pytest.fixture
def mock_mongo() -> Database:
    """
    Mock mongodb connection
    :return: mocked collection
    """
    client = MongoClient()
    db = client['ada-test-db']
    db.create_collection('zips')
    db.zips.insert_many(
        [
            {"fruit":"apple","colour": "red", "eaten": datetime.datetime(2022,1,1), "order": 3, "size": 10.01}, 
            {"fruit":"orange","colour": "orange", "eaten": datetime.datetime(2022,2,1), "order": 2, "size": 12.01},
            {"fruit":"pear","colour": "green", "eaten": datetime.datetime(2022,3,1), "order": 1, "size": 13.01}, 
        ]
    )
    return client


def test_schedule_data_import_bare(mocker, mock_mongo, sm_client, sm_create, s3_client, s3_create, ddb_client, ddb_create):

    (mocker.patch('mongodb_data_import.MongoDBContextManager').
     return_value.__enter__.return_value) = mock_mongo

    mdbi = MongoDBImport(
        db_endpoint=DB_ENDPOINT,
        db_port=DB_PORT,
        db_name=DB_NAME,
        collection_name=COLLECTION_NAME,
        username=USERNAME,
        password=PASSWORD,
        s3_output_uri=S3_OUTPUT_BUCKET_URI,
        table_name=TABLE_NAME,
        data_product_id=DATA_PRODUCT_ID,
        domain_id=DOMAIN_ID,
        trigger_type=TRIGGER_TYPE,
        tls='',
        tls_ca='',
        tls_cert_key='',
        extra_params='testing=true, non_prod=true',
        bookmark_field='',
        bookmark_field_type='',
    )

    mdbi.execute()

    #assert False

    # check that file has been written
    response = s3_client.list_objects_v2(
        Bucket='ada-testing-bucket',
    )

    assert_that(response['KeyCount']).is_equal_to(1)

    # check that ddb lastUpdatedTime has been written
    response = ddb_client.get_item(
        Key={
            'dataProductId': {'S': DATA_PRODUCT_ID},
            'domainId': {'S': DOMAIN_ID}
        },
        TableName=TABLE_NAME,
    )

    assert_that(parser.parse(response['Item']['timestamp']['S'])).is_type_of(
        datetime.datetime)
    

def test_schedule_data_import_index_val_timestamp(mocker, mock_mongo, sm_client, sm_create, s3_client, s3_create, ddb_client, ddb_create):

    (mocker.patch('mongodb_data_import.MongoDBContextManager').
     return_value.__enter__.return_value) = mock_mongo

    mdbi = MongoDBImport(
        db_endpoint=DB_ENDPOINT,
        db_port=DB_PORT,
        db_name=DB_NAME,
        collection_name=COLLECTION_NAME,
        username=USERNAME,
        password=PASSWORD,
        s3_output_uri=S3_OUTPUT_BUCKET_URI,
        table_name=TABLE_NAME,
        data_product_id=DATA_PRODUCT_ID,
        domain_id=DOMAIN_ID,
        trigger_type=TRIGGER_TYPE,
        tls='',
        tls_ca='',
        tls_cert_key='',
        extra_params='',
        bookmark_field='eaten',
        bookmark_field_type='timestamp',
    )

    mdbi.execute()

        # check that file has been written
    response = s3_client.list_objects_v2(
        Bucket='ada-testing-bucket',
    )

    assert_that(response['KeyCount']).is_equal_to(1)

    # check that ddb lastUpdatedTime has been written
    response = ddb_client.get_item(
        Key={
            'dataProductId': {'S': DATA_PRODUCT_ID},
            'domainId': {'S': DOMAIN_ID}
        },
        TableName=TABLE_NAME,
    )
    assert_that(parser.parse(response['Item']['timestamp']['S'])).is_type_of(
        datetime.datetime)
    assert_that(parser.parse(response['Item']['max_index_value']['S'])).is_type_of(
        datetime.datetime)
    assert_that(parser.parse(response['Item']['max_index_value']['S'])).is_equal_to(datetime.datetime(2022,3,1))
    assert_that(response['Item']['num_rows']['S']).is_equal_to('3')

    mock_mongo['ada-test-db']['zips'].insert_one(
        {"fruit":"lychee","colour": "white", "eaten": datetime.datetime(2022,2,20), "order": 1, "size": 6.01},
    )

    mdbi.execute()

    response = ddb_client.get_item(
        Key={
            'dataProductId': {'S': DATA_PRODUCT_ID},
            'domainId': {'S': DOMAIN_ID}
        },
        TableName=TABLE_NAME,
    )
    assert_that(parser.parse(response['Item']['timestamp']['S'])).is_type_of(
        datetime.datetime)
    assert_that(parser.parse(response['Item']['max_index_value']['S'])).is_type_of(
        datetime.datetime)
    assert_that(parser.parse(response['Item']['max_index_value']['S'])).is_equal_to(datetime.datetime(2022,3,1))
    assert_that(response['Item']['num_rows']['S']).is_equal_to('0')

    mock_mongo['ada-test-db']['zips'].insert_one(
        {"fruit":"pineapple","colour": "yellow", "eaten": datetime.datetime(2023,3,2), "order": 4, "size": 20.01},
    )

    mdbi.execute()

    response = ddb_client.get_item(
        Key={
            'dataProductId': {'S': DATA_PRODUCT_ID},
            'domainId': {'S': DOMAIN_ID}
        },
        TableName=TABLE_NAME,
    )
    assert_that(parser.parse(response['Item']['timestamp']['S'])).is_type_of(
        datetime.datetime)
    assert_that(parser.parse(response['Item']['max_index_value']['S'])).is_type_of(
        datetime.datetime)
    assert_that(parser.parse(response['Item']['max_index_value']['S'])).is_equal_to(datetime.datetime(2023,3,2))
    assert_that(response['Item']['num_rows']['S']).is_equal_to('1')


def test_schedule_data_import_index_val_integer(mocker, mock_mongo, sm_client, sm_create, s3_client, s3_create, ddb_client, ddb_create):

    (mocker.patch('mongodb_data_import.MongoDBContextManager').
     return_value.__enter__.return_value) = mock_mongo

    mdbi = MongoDBImport(
        db_endpoint=DB_ENDPOINT,
        db_port=DB_PORT,
        db_name=DB_NAME,
        collection_name=COLLECTION_NAME,
        username=USERNAME,
        password=PASSWORD,
        s3_output_uri=S3_OUTPUT_BUCKET_URI,
        table_name=TABLE_NAME,
        data_product_id=DATA_PRODUCT_ID,
        domain_id=DOMAIN_ID,
        trigger_type=TRIGGER_TYPE,
        tls='',
        tls_ca='',
        tls_cert_key='',
        extra_params='',
        bookmark_field='order',
        bookmark_field_type='integer',
    )

    mdbi.execute()

        # check that file has been written
    response = s3_client.list_objects_v2(
        Bucket='ada-testing-bucket',
    )

    assert_that(response['KeyCount']).is_equal_to(1)

    # check that ddb lastUpdatedTime has been written
    response = ddb_client.get_item(
        Key={
            'dataProductId': {'S': DATA_PRODUCT_ID},
            'domainId': {'S': DOMAIN_ID}
        },
        TableName=TABLE_NAME,
    )
    assert_that(parser.parse(response['Item']['timestamp']['S'])).is_type_of(
        datetime.datetime)
    assert_that(parser.parse(response['Item']['max_index_value']['S'])).is_type_of(
        datetime.datetime)
    assert_that(response['Item']['max_index_value']['S']).is_equal_to('3')
    assert_that(response['Item']['num_rows']['S']).is_equal_to('3')

    mock_mongo['ada-test-db']['zips'].insert_one(
        {"fruit":"lychee","colour": "white", "eaten": datetime.datetime(2022,2,20), "order": 2, "size": 6.01},
    )

    mdbi.execute()

    response = ddb_client.get_item(
        Key={
            'dataProductId': {'S': DATA_PRODUCT_ID},
            'domainId': {'S': DOMAIN_ID}
        },
        TableName=TABLE_NAME,
    )
    assert_that(parser.parse(response['Item']['timestamp']['S'])).is_type_of(
        datetime.datetime)
    assert_that(response['Item']['max_index_value']['S']).is_equal_to('3')
    assert_that(response['Item']['num_rows']['S']).is_equal_to('0')

    mock_mongo['ada-test-db']['zips'].insert_one(
        {"fruit":"pineapple","colour": "yellow", "eaten": datetime.datetime(2023,3,2), "order": 4, "size": 20.01},
    )

    mdbi.execute()

    response = ddb_client.get_item(
        Key={
            'dataProductId': {'S': DATA_PRODUCT_ID},
            'domainId': {'S': DOMAIN_ID}
        },
        TableName=TABLE_NAME,
    )
    assert_that(parser.parse(response['Item']['timestamp']['S'])).is_type_of(
        datetime.datetime)
    assert_that(response['Item']['max_index_value']['S']).is_equal_to('4')
    assert_that(response['Item']['num_rows']['S']).is_equal_to('1')

def test_schedule_data_import_index_val_string(mocker, mock_mongo, sm_client, sm_create, s3_client, s3_create, ddb_client, ddb_create):

    (mocker.patch('mongodb_data_import.MongoDBContextManager').
     return_value.__enter__.return_value) = mock_mongo

    mdbi = MongoDBImport(
        db_endpoint=DB_ENDPOINT,
        db_port=DB_PORT,
        db_name=DB_NAME,
        collection_name=COLLECTION_NAME,
        username=USERNAME,
        password=PASSWORD,
        s3_output_uri=S3_OUTPUT_BUCKET_URI,
        table_name=TABLE_NAME,
        data_product_id=DATA_PRODUCT_ID,
        domain_id=DOMAIN_ID,
        trigger_type=TRIGGER_TYPE,
        tls='',
        tls_ca='',
        tls_cert_key='',
        extra_params='',
        bookmark_field='fruit',
        bookmark_field_type='string',
    )

    mdbi.execute()

        # check that file has been written
    response = s3_client.list_objects_v2(
        Bucket='ada-testing-bucket',
    )

    assert_that(response['KeyCount']).is_equal_to(1)

    # check that ddb lastUpdatedTime has been written
    response = ddb_client.get_item(
        Key={
            'dataProductId': {'S': DATA_PRODUCT_ID},
            'domainId': {'S': DOMAIN_ID}
        },
        TableName=TABLE_NAME,
    )
    assert_that(parser.parse(response['Item']['timestamp']['S'])).is_type_of(
        datetime.datetime)
    assert_that(response['Item']['max_index_value']['S']).is_equal_to('pear')
    assert_that(response['Item']['num_rows']['S']).is_equal_to('3')

    mock_mongo['ada-test-db']['zips'].insert_one(
        {"fruit":"lychee","colour": "white", "eaten": datetime.datetime(2022,2,20), "order": 2, "size": 6.01},
    )

    mdbi.execute()

    response = ddb_client.get_item(
        Key={
            'dataProductId': {'S': DATA_PRODUCT_ID},
            'domainId': {'S': DOMAIN_ID}
        },
        TableName=TABLE_NAME,
    )
    assert_that(parser.parse(response['Item']['timestamp']['S'])).is_type_of(
        datetime.datetime)
    assert_that(response['Item']['max_index_value']['S']).is_equal_to('pear')
    assert_that(response['Item']['num_rows']['S']).is_equal_to('0')

    mock_mongo['ada-test-db']['zips'].insert_one(
        {"fruit":"pineapple","colour": "yellow", "eaten": datetime.datetime(2023,3,2), "order": 4, "size": 20.01},
    )

    mdbi.execute()

    response = ddb_client.get_item(
        Key={
            'dataProductId': {'S': DATA_PRODUCT_ID},
            'domainId': {'S': DOMAIN_ID}
        },
        TableName=TABLE_NAME,
    )
    assert_that(parser.parse(response['Item']['timestamp']['S'])).is_type_of(
        datetime.datetime)
    assert_that(response['Item']['max_index_value']['S']).is_equal_to('pineapple')
    assert_that(response['Item']['num_rows']['S']).is_equal_to('1')


def test_schedule_data_import_index_val_type(mocker, mock_mongo, sm_create, s3_create, ddb_create, capsys):

    (mocker.patch('mongodb_data_import.MongoDBContextManager').
     return_value.__enter__.return_value) = mock_mongo

    mdbi = MongoDBImport(
        db_endpoint=DB_ENDPOINT,
        db_port=DB_PORT,
        db_name=DB_NAME,
        collection_name=COLLECTION_NAME,
        username=USERNAME,
        password=PASSWORD,
        s3_output_uri=S3_OUTPUT_BUCKET_URI,
        table_name=TABLE_NAME,
        data_product_id=DATA_PRODUCT_ID,
        domain_id=DOMAIN_ID,
        trigger_type=TRIGGER_TYPE,
        tls='',
        tls_ca='',
        tls_cert_key='',
        extra_params='',
        bookmark_field='fruit',
        bookmark_field_type='integer',
    )

    mdbi.execute()

    captured = capsys.readouterr()
    assert_that(captured.out).contains("Incorrect Bookmark Field type")
    

def test_schedule_data_import_index_val_float(mocker, mock_mongo, sm_client, sm_create, s3_client, s3_create, ddb_client, ddb_create):

    (mocker.patch('mongodb_data_import.MongoDBContextManager').
     return_value.__enter__.return_value) = mock_mongo

    mdbi = MongoDBImport(
        db_endpoint=DB_ENDPOINT,
        db_port=DB_PORT,
        db_name=DB_NAME,
        collection_name=COLLECTION_NAME,
        username=USERNAME,
        password=PASSWORD,
        s3_output_uri=S3_OUTPUT_BUCKET_URI,
        table_name=TABLE_NAME,
        data_product_id=DATA_PRODUCT_ID,
        domain_id=DOMAIN_ID,
        trigger_type=TRIGGER_TYPE,
        tls='',
        tls_ca='',
        tls_cert_key='',
        extra_params='',
        bookmark_field='size',
        bookmark_field_type='integer',
    )

    mdbi.execute()

            # check that file has been written
    response = s3_client.list_objects_v2(
        Bucket='ada-testing-bucket',
    )

    assert_that(response['KeyCount']).is_equal_to(1)

    # check that ddb lastUpdatedTime has been written
    response = ddb_client.get_item(
        Key={
            'dataProductId': {'S': DATA_PRODUCT_ID},
            'domainId': {'S': DOMAIN_ID}
        },
        TableName=TABLE_NAME,
    )
    assert_that(parser.parse(response['Item']['timestamp']['S'])).is_type_of(
        datetime.datetime)
    assert_that(response['Item']['max_index_value']['S']).is_equal_to('13.01')
    assert_that(response['Item']['num_rows']['S']).is_equal_to('3')

def test_schedule_data_import_tls_http_ca_client_cert(mocker, mock_mongo, sm_client, sm_create, s3_client, s3_create, ddb_client, ddb_create, requests_mock):

    (mocker.patch('mongodb_data_import.MongoDBContextManager').
     return_value.__enter__.return_value) = mock_mongo
    
    requests_mock.get(TLS_CA, text='data')

    m = mocker.patch('builtins.open')

    mdbi = MongoDBImport(
        db_endpoint=DB_ENDPOINT,
        db_port=DB_PORT,
        db_name=DB_NAME,
        collection_name=COLLECTION_NAME,
        username=USERNAME,
        password=PASSWORD,
        s3_output_uri=S3_OUTPUT_BUCKET_URI,
        table_name=TABLE_NAME,
        data_product_id=DATA_PRODUCT_ID,
        domain_id=DOMAIN_ID,
        trigger_type=TRIGGER_TYPE,
        tls="true",
        tls_ca=TLS_CA,
        tls_cert_key=TLS_CLIENT_CERT_ID,
        extra_params='',
        bookmark_field='size',
        bookmark_field_type='integer',
    )

    mdbi.execute()

            # check that file has been written
    response = s3_client.list_objects_v2(
        Bucket='ada-testing-bucket',
    )
    assert_that(response['KeyCount']).is_equal_to(1)

    # check that ddb lastUpdatedTime has been written
    response = ddb_client.get_item(
        Key={
            'dataProductId': {'S': DATA_PRODUCT_ID},
            'domainId': {'S': DOMAIN_ID}
        },
        TableName=TABLE_NAME,
    )
    assert_that(parser.parse(response['Item']['timestamp']['S'])).is_type_of(
        datetime.datetime)
    assert_that(response['Item']['max_index_value']['S']).is_equal_to('13.01')
    assert_that(response['Item']['num_rows']['S']).is_equal_to('3')

    assert_that(m.call_count).is_equal_to(2)
    assert_that(m.call_args_list[0][0]).is_equal_to(('/tmp/ca.pem', 'w'))
    assert_that(m.call_args_list[1][0]).is_equal_to(('/tmp/client.pem', 'w'))


def test_schedule_data_import_tls_s3_ca_client_cert(mocker, mock_mongo, sm_client, sm_create, s3_client, s3_create, ddb_client, ddb_create, requests_mock):

    (mocker.patch('mongodb_data_import.MongoDBContextManager').
     return_value.__enter__.return_value) = mock_mongo

    mdbi = MongoDBImport(
        db_endpoint=DB_ENDPOINT,
        db_port=DB_PORT,
        db_name=DB_NAME,
        collection_name=COLLECTION_NAME,
        username=USERNAME,
        password=PASSWORD,
        s3_output_uri=S3_OUTPUT_BUCKET_URI,
        table_name=TABLE_NAME,
        data_product_id=DATA_PRODUCT_ID,
        domain_id=DOMAIN_ID,
        trigger_type=TRIGGER_TYPE,
        tls="true",
        tls_ca=TLS_CA_S3,
        tls_cert_key=TLS_CLIENT_CERT_ID,
        extra_params='',
        bookmark_field='size',
        bookmark_field_type='integer',
    )

    mdbi.execute()

            # check that file has been written
    response = s3_client.list_objects_v2(
        Bucket='ada-testing-bucket',
    )
    assert_that(response['KeyCount']).is_equal_to(1)

    # check that ddb lastUpdatedTime has been written
    response = ddb_client.get_item(
        Key={
            'dataProductId': {'S': DATA_PRODUCT_ID},
            'domainId': {'S': DOMAIN_ID}
        },
        TableName=TABLE_NAME,
    )
    assert_that(parser.parse(response['Item']['timestamp']['S'])).is_type_of(
        datetime.datetime)
    assert_that(response['Item']['max_index_value']['S']).is_equal_to('13.01')
    assert_that(response['Item']['num_rows']['S']).is_equal_to('3')

def test_schedule_data_import_tls_s3_ca_client_cert_raises(mocker, mock_mongo, sm_client, sm_create, s3_client, s3_create, ddb_client, ddb_create, requests_mock): 
    with pytest.raises(CADownloaderException):
        (mocker.patch('mongodb_data_import.MongoDBContextManager').
        return_value.__enter__.return_value) = mock_mongo
            
        mdbi = MongoDBImport(
            db_endpoint=DB_ENDPOINT,
            db_port=DB_PORT,
            db_name=DB_NAME,
            collection_name=COLLECTION_NAME,
            username=USERNAME,
            password=PASSWORD,
            s3_output_uri=S3_OUTPUT_BUCKET_URI,
            table_name=TABLE_NAME,
            data_product_id=DATA_PRODUCT_ID,
            domain_id=DOMAIN_ID,
            trigger_type=TRIGGER_TYPE,
            tls="true",
            tls_ca="s3://certs/noexist/cacert.pem",
            tls_cert_key=TLS_CLIENT_CERT_ID,
            extra_params='',
            bookmark_field='size',
            bookmark_field_type='integer',
        )


def test_schedule_data_import_raises_if_index_type_missing(mocker, mock_mongo, sm_client, sm_create, s3_client, s3_create, ddb_client, ddb_create, requests_mock):

    with pytest.raises(MissingParameterException):
        mdbi = MongoDBImport(
            db_endpoint=DB_ENDPOINT,
            db_port=DB_PORT,
            db_name=DB_NAME,
            collection_name=COLLECTION_NAME,
            username=USERNAME,
            password=PASSWORD,
            s3_output_uri=S3_OUTPUT_BUCKET_URI,
            table_name=TABLE_NAME,
            data_product_id=DATA_PRODUCT_ID,
            domain_id=DOMAIN_ID,
            trigger_type=TRIGGER_TYPE,
            tls="true",
            tls_ca=TLS_CA,
            tls_cert_key=TLS_CLIENT_CERT_ID,
            extra_params='',
            bookmark_field='size',
            bookmark_field_type='',
        )

def test_missing_db_endpoint_raises_exception():
    with pytest.raises(MissingParameterException):
        mdbi = MongoDBImport(
            db_endpoint='',
            db_port=DB_PORT,
            db_name=DB_NAME,
            collection_name=COLLECTION_NAME,
            username=USERNAME,
            password=PASSWORD,
            s3_output_uri=S3_OUTPUT_BUCKET_URI,
            table_name=TABLE_NAME,
            data_product_id=DATA_PRODUCT_ID,
            domain_id=DOMAIN_ID,
            trigger_type=TRIGGER_TYPE,
            tls="true",
            tls_ca=TLS_CA,
            tls_cert_key=TLS_CLIENT_CERT_ID,
            extra_params='',
            bookmark_field='size',
            bookmark_field_type='',
        )

def test_missing_db_port_raises_exception():
    with pytest.raises(MissingParameterException):
        mdbi = MongoDBImport(
            db_endpoint=DB_ENDPOINT,
            db_port='',
            db_name=DB_NAME,
            collection_name=COLLECTION_NAME,
            username=USERNAME,
            password=PASSWORD,
            s3_output_uri=S3_OUTPUT_BUCKET_URI,
            table_name=TABLE_NAME,
            data_product_id=DATA_PRODUCT_ID,
            domain_id=DOMAIN_ID,
            trigger_type=TRIGGER_TYPE,
            tls="true",
            tls_ca=TLS_CA,
            tls_cert_key=TLS_CLIENT_CERT_ID,
            extra_params='',
            bookmark_field='size',
            bookmark_field_type='',
        )

def test_missing_db_name_raises_exception():
    with pytest.raises(MissingParameterException):
        mdbi = MongoDBImport(
            db_endpoint=DB_ENDPOINT,
            db_port=DB_PORT,
            db_name='',
            collection_name=COLLECTION_NAME,
            username=USERNAME,
            password=PASSWORD,
            s3_output_uri=S3_OUTPUT_BUCKET_URI,
            table_name=TABLE_NAME,
            data_product_id=DATA_PRODUCT_ID,
            domain_id=DOMAIN_ID,
            trigger_type=TRIGGER_TYPE,
            tls="true",
            tls_ca=TLS_CA,
            tls_cert_key=TLS_CLIENT_CERT_ID,
            extra_params='',
            bookmark_field='size',
            bookmark_field_type='',
        )

def test_missing_collection_name_raises_exception():
    with pytest.raises(MissingParameterException):
        mdbi = MongoDBImport(
            db_endpoint=DB_ENDPOINT,
            db_port=DB_PORT,
            db_name=DB_NAME,
            collection_name='',
            username=USERNAME,
            password=PASSWORD,
            s3_output_uri=S3_OUTPUT_BUCKET_URI,
            table_name=TABLE_NAME,
            data_product_id=DATA_PRODUCT_ID,
            domain_id=DOMAIN_ID,
            trigger_type=TRIGGER_TYPE,
            tls="true",
            tls_ca=TLS_CA,
            tls_cert_key=TLS_CLIENT_CERT_ID,
            extra_params='',
            bookmark_field='size',
            bookmark_field_type='',
        )

def test_missing_username_raises_exception():
    with pytest.raises(MissingParameterException):
        mdbi = MongoDBImport(
            db_endpoint=DB_ENDPOINT,
            db_port=DB_PORT,
            db_name=DB_NAME,
            collection_name=COLLECTION_NAME,
            username='',
            password=PASSWORD,
            s3_output_uri=S3_OUTPUT_BUCKET_URI,
            table_name=TABLE_NAME,
            data_product_id=DATA_PRODUCT_ID,
            domain_id=DOMAIN_ID,
            trigger_type=TRIGGER_TYPE,
            tls="true",
            tls_ca=TLS_CA,
            tls_cert_key=TLS_CLIENT_CERT_ID,
            extra_params='',
            bookmark_field='size',
            bookmark_field_type='',
        )

def test_missing_password_raises_exception():
    with pytest.raises(MissingParameterException):
        mdbi = MongoDBImport(
            db_endpoint=DB_ENDPOINT,
            db_port=DB_PORT,
            db_name=DB_NAME,
            collection_name=COLLECTION_NAME,
            username=USERNAME,
            password='',
            s3_output_uri=S3_OUTPUT_BUCKET_URI,
            table_name=TABLE_NAME,
            data_product_id=DATA_PRODUCT_ID,
            domain_id=DOMAIN_ID,
            trigger_type=TRIGGER_TYPE,
            tls="true",
            tls_ca=TLS_CA,
            tls_cert_key=TLS_CLIENT_CERT_ID,
            extra_params='',
            bookmark_field='size',
            bookmark_field_type='',
        )


def test_missing_s3_output_uri_raises_exception():
    with pytest.raises(MissingParameterException):
        mdbi = MongoDBImport(
            db_endpoint=DB_ENDPOINT,
            db_port=DB_PORT,
            db_name=DB_NAME,
            collection_name=COLLECTION_NAME,
            username=USERNAME,
            password=PASSWORD,
            s3_output_uri='',
            table_name=TABLE_NAME,
            data_product_id=DATA_PRODUCT_ID,
            domain_id=DOMAIN_ID,
            trigger_type=TRIGGER_TYPE,
            tls="true",
            tls_ca=TLS_CA,
            tls_cert_key=TLS_CLIENT_CERT_ID,
            extra_params='',
            bookmark_field='size',
            bookmark_field_type='',
        )

def test_missing_data_product_id_raises_exception():
    with pytest.raises(MissingParameterException):
        mdbi = MongoDBImport(
            db_endpoint=DB_ENDPOINT,
            db_port=DB_PORT,
            db_name=DB_NAME,
            collection_name=COLLECTION_NAME,
            username=USERNAME,
            password=PASSWORD,
            s3_output_uri=S3_OUTPUT_BUCKET_URI,
            table_name=TABLE_NAME,
            data_product_id='',
            domain_id=DOMAIN_ID,
            trigger_type=TRIGGER_TYPE,
            tls="true",
            tls_ca=TLS_CA,
            tls_cert_key=TLS_CLIENT_CERT_ID,
            extra_params='',
            bookmark_field='size',
            bookmark_field_type='',
        )



def test_missing_table_name_raises_exception():
    with pytest.raises(MissingParameterException):
        mdbi = MongoDBImport(
            db_endpoint=DB_ENDPOINT,
            db_port=DB_PORT,
            db_name=DB_NAME,
            collection_name=COLLECTION_NAME,
            username=USERNAME,
            password=PASSWORD,
            s3_output_uri=S3_OUTPUT_BUCKET_URI,
            table_name='',
            data_product_id=DATA_PRODUCT_ID,
            domain_id=DOMAIN_ID,
            trigger_type=TRIGGER_TYPE,
            tls="true",
            tls_ca=TLS_CA,
            tls_cert_key=TLS_CLIENT_CERT_ID,
            extra_params='',
            bookmark_field='size',
            bookmark_field_type='',
        )

def test_missing_domain_id_raises_exception():
    with pytest.raises(MissingParameterException):
        mdbi = MongoDBImport(
            db_endpoint=DB_ENDPOINT,
            db_port=DB_PORT,
            db_name=DB_NAME,
            collection_name=COLLECTION_NAME,
            username=USERNAME,
            password=PASSWORD,
            s3_output_uri=S3_OUTPUT_BUCKET_URI,
            table_name=TABLE_NAME,
            data_product_id=DATA_PRODUCT_ID,
            domain_id='',
            trigger_type=TRIGGER_TYPE,
            tls="true",
            tls_ca=TLS_CA,
            tls_cert_key=TLS_CLIENT_CERT_ID,
            extra_params='',
            bookmark_field='size',
            bookmark_field_type='',
        )

def test_missing_trigger_type_raises_exception():
    with pytest.raises(MissingParameterException):
        mdbi = MongoDBImport(
            db_endpoint=DB_ENDPOINT,
            db_port=DB_PORT,
            db_name=DB_NAME,
            collection_name=COLLECTION_NAME,
            username=USERNAME,
            password=PASSWORD,
            s3_output_uri=S3_OUTPUT_BUCKET_URI,
            table_name=TABLE_NAME,
            data_product_id=DATA_PRODUCT_ID,
            domain_id=DOMAIN_ID,
            trigger_type='',
            tls="true",
            tls_ca=TLS_CA,
            tls_cert_key=TLS_CLIENT_CERT_ID,
            extra_params='',
            bookmark_field='size',
            bookmark_field_type='',
        )
