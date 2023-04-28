###################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0 
###################################################################

"""
Cypress tests aws helper module, assumes that a aws credentials are set as environment
variables
    - upload and delete s3 buckets and objects
    - create, get summary, push data and delete a kinesis data stream

Raises:
    HelperException: Exception raised by this module, sent to cypress test runner
"""

import argparse
import boto3
import datetime

class HelperException(Exception):
    """
    Custom Exception for this module
    Args:
        Exception : Base Exception class
    """

def create_kinesis_stream(client: boto3.client, stream_name: str):
    """
    Create a kinesis stream on the aws

    Args:
        client (boto3.client): kinesis client
        stream_name (str): kinesis stream name to create

    Raises:
        HelperException: Raises if failed to create kinesis stream
    """
    response = client.create_stream(
        StreamName=stream_name,
    )

    if response['ResponseMetadata']['HTTPStatusCode'] != 200:
        raise HelperException("Failed to create kinesis stream")

def get_stream_summary(client: boto3.client, stream_name: str):
    """
    Get the summary of a kinesis stream

    Args:
        client (boto3.client): kinesis client
        stream_name (str): kinesis stream name to get summary on

    Raises:
        HelperException: Raises if failed to get kinesis stream summary
    """
    response = client.describe_stream_summary(
        StreamName=stream_name)

    if response['ResponseMetadata']['HTTPStatusCode'] != 200:
        raise HelperException("Failed to get kinesis stream summary")

    print(response['StreamDescriptionSummary']['StreamARN'])

def push_kinesis_data(client: boto3.client, stream_name: str, partition_key: str, file_path: str):
    """
    Push data to a kinesis data stream

    Args:
        client (boto3.client): kinesis client
        stream_name (str): kinesis stream name to push data to
        partition_key (str): partition key of the data
        file_path (str): path to the file containing data to push

    Raises:
        HelperException: Raises if data push to kinesis stream fails
    """
    with open(file_path, "rb") as in_file:
        file_b = in_file.read()
        response = client.put_record(
            StreamName=stream_name,
            Data=file_b,
            PartitionKey=partition_key,

        )
        if response['ResponseMetadata']['HTTPStatusCode'] != 200:
            raise HelperException("Failed to push data to kinesis stream")

def delete_kinesis_stream(client: boto3.client, stream_name: str):
    """
    Delete kineses stream

    Args:
        client (boto3.client): kinesis client
        stream_name (str): kinesis stream name to delete

    Raises:
        HelperException: Raises if failed to delete kinesis stream
    """
    response = client.delete_stream(
        StreamName=stream_name,
    )
    if response['ResponseMetadata']['HTTPStatusCode'] != 200:
        raise HelperException("Failed to delete kinesis stream")

def s3_upload_file(client: boto3.client, bucket: str, file_path: str, key: str, region: str):
    """
    Create an s3 bucket, and upload the provided file with the given key

    Args:
        client (boto3.client): s3 client
        bucket (str): bucket name to create
        file_path (str): path to file to upload
        key (str): key for artifacts in s3
        region (str): region in which the bucket will be created
    """
    client.create_bucket(Bucket=bucket, CreateBucketConfiguration={
            'LocationConstraint': region
        })

    with open(file_path, 'rb') as data:
        client.upload_fileobj(data, bucket, key)

def s3_delete_file(client: boto3.client, bucket: str, key: str):
    """
    Delete the artifacts located at key, and delete the s3 bucket

    Args:
        client (boto3.client): s3 client
        bucket (str): bucket name to create
        key (str): key for artifacts in s3
    """
    response = client.delete_object(Bucket=bucket, Key=key)

    if response['ResponseMetadata']['HTTPStatusCode'] != 204:
        raise HelperException("Object not deleted successfully")

    response = client.delete_bucket(Bucket=bucket)

    if response['ResponseMetadata']['HTTPStatusCode'] != 204:
        raise HelperException("Bucket not deleted successfully")

def create_dynamodb_table(client: boto3.client, table_name: str):
    """
    Create a dymamodb table on the aws

    Args:
        client (boto3.client): dynamodb client
        table_name (str): dynamodb table name to create
    """

    params = {
        'TableName': table_name,
        'KeySchema': [
            {'AttributeName': 'partition_key', 'KeyType': 'HASH'},
            {'AttributeName': 'sort_key', 'KeyType': 'RANGE'}
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'partition_key', 'AttributeType': 'N'},
            {'AttributeName': 'sort_key', 'AttributeType': 'N'}
        ],
        'ProvisionedThroughput': {
            'ReadCapacityUnits': 10,
            'WriteCapacityUnits': 10
        }
    }
    client.create_table(**params)

def delete_dynamodb_table(client: boto3.client, table_name: str):
    """
    Delete a dymamodb table on the aws

    Args:
        client (boto3.client): dynamodb client
        table_name (str): dynamodb table name to delete
    """
    client.delete_table(TableName=table_name)


def get_dynamodb_table_summary(client: boto3.client, table_name: str):
    """
    Get the summary of a dynamodb table

    Args:
        client (boto3.client): kinesis client
        table_name (str): dynamodb table to get summary on

    Raises:
        HelperException: Raises if failed to get dynamodb table summary
    """
    response = client.describe_table(
    TableName=table_name
    )

    if response['ResponseMetadata']['HTTPStatusCode'] != 200:
        raise HelperException("Failed to get kinesis stream summary")

    print(response['Table']['TableArn'])


def create_dynamodb_record(resource: boto3.resource, table_name: str, id: int, value: int):
    """
    Create a record in the dynamodb table

    Args:
        client (boto3.client): dynamodb client
        table_name (str): dynamodb table name to update
        id (int): an identifier to place into the record
        value (int): a value to place into the record
    """
    table = resource.Table(table_name)
    response = table.put_item(
        Item={
            'partition_key': id,
            'sort_key': value
        }
    )

    if response['ResponseMetadata']['HTTPStatusCode'] != 200:
        raise HelperException("Failed to create DynamoDb record")

def create_cloudtrail(cloudtrail_client: boto3.client, s3_client: boto3.client, sts_client: boto3.client, trail_name: str, bucket_name: str, region: str):
    """
    Create a CloudTrail trail on AWS - must also create the necessary bucket required.
    Args:
        cloudtrail_client (boto3.client): cloudtrail client
        s3_client (boto3.client): s3 client
        sts_client( boto3.client): sts client
        trail_name: name of trail to create
        bucket_name: name of bucket to create
        region: AWS region to apply
    """

    account_id = boto3.client('sts').get_caller_identity().get('Account')
    cid = sts_client.get_caller_identity()
    principal = cid['Arn']

    bucket_policy = """{{
        "Version": "2012-10-17",
        "Statement": [
            {{
                "Sid": "AWSCloudTrailAclCheck20150319",
                "Effect": "Allow",
                "Principal": {{"Service": "cloudtrail.amazonaws.com"}},
                "Action": "s3:GetBucketAcl",
                "Resource": "arn:aws:s3:::{bucket_name}",
                "Condition": {{
                    "StringEquals": {{
                        "aws:SourceArn": "arn:aws:cloudtrail:{region}:{account_id}:trail/{trail_name}"
                    }}
                }}
            }},
            {{
                "Sid": "AWSCloudTrailWrite20150319",
                "Effect": "Allow",
                "Principal": {{"Service": "cloudtrail.amazonaws.com"}},
                "Action": "s3:PutObject",
                "Resource": "arn:aws:s3:::{bucket_name}/AWSLogs/{account_id}/*",
                "Condition": {{
                    "StringEquals": {{
                        "s3:x-amz-acl": "bucket-owner-full-control",
                        "aws:SourceArn": "arn:aws:cloudtrail:{region}:{account_id}:trail/{trail_name}"
                    }}
                }}
            }},
            {{
                "Sid": "Stmt1546414471931",
                "Effect": "Allow",
                "Principal": {{
                    "AWS": "{principal}"
                }},
                "Action": "s3:*",
                "Resource": "arn:aws:s3:::{bucket_name}"
            }},
            {{
                "Sid": "Stmt1546414471931",
                "Effect": "Allow",
                "Principal": {{
                    "AWS": "{principal}"
                }},
                "Action": "s3:*",
                "Resource": "arn:aws:s3:::{bucket_name}/*"
            }}
        ]
    }}""".format(account_id=account_id, region=region, trail_name=trail_name,bucket_name=bucket_name, principal=principal)

    s3response = s3_client.create_bucket(
        Bucket=bucket_name, 
        CreateBucketConfiguration={
            'LocationConstraint': region
        }
    )

    s3_client.put_bucket_policy(
        Bucket=bucket_name,
        Policy=bucket_policy
    )

    now = datetime.datetime.now().date()
    start_date = now - datetime.timedelta(days=3)
    end_date = now - datetime.timedelta(days=2)

    with open('cypress/fixtures/sample_trail_data.json.gz', 'rb') as data:
        s3_client.upload_fileobj(data, bucket_name, 'AWSLogs/{account_id}/CloudTrail/{region}/{year}/{month}/{day}/{account_id}_CloudTrail_{region}_{year}{month}{day}.json.gz'.format(
            region=region, account_id=account_id, year=start_date.strftime("%Y"), month=start_date.strftime("%m"), day=start_date.strftime("%d")
        ))

    with open('cypress/fixtures/sample_trail_data.json.gz', 'rb') as data:
        s3_client.upload_fileobj(data, bucket_name, 'AWSLogs/{account_id}/CloudTrail/{region}/{year}/{month}/{day}/{account_id}_CloudTrail_{region}_{year}{month}{day}.json.gz'.format(
            region=region, account_id=account_id, year=end_date.strftime("%Y"), month=end_date.strftime("%m"), day=end_date.strftime("%d")
        ))

    trailresponse = cloudtrail_client.create_trail(Name=trail_name, S3BucketName=bucket_name, IsMultiRegionTrail=True, IncludeGlobalServiceEvents=True)
    
    cloudtrail_client.start_logging(Name=trailresponse['TrailARN'])
    
    print(trailresponse['TrailARN'])

def delete_cloudtrail(cloudtrail_client: boto3.client, s3_client: boto3.client, s3_resource, trail_name: str, bucket_name: str):
    cloudtrail_client.delete_trail(Name=trail_name)
    bucket = s3_resource.Bucket(bucket_name)
    bucket.objects.all().delete()
    s3_client.delete_bucket(Bucket=bucket_name)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    subparser = parser.add_subparsers(dest='command')
    kinesis_create = subparser.add_parser('kinesis_create')
    kinesis_summary = subparser.add_parser('kinesis_summary')
    kinesis_data = subparser.add_parser('kinesis_data')
    kinesis_delete = subparser.add_parser('kinesis_delete')
    s3_upload = subparser.add_parser('s3_upload')
    s3_delete = subparser.add_parser('s3_delete')
    
    dynamodb_table_create = subparser.add_parser('dynamodb_table_create')
    dynamodb_table_delete = subparser.add_parser('dynamodb_table_delete')
    dynamodb_table_summary = subparser.add_parser('dynamodb_table_summary')
    dynamodb_record_create = subparser.add_parser('dynamodb_record_create')

    cloudtrail_create = subparser.add_parser('cloudtrail_create')
    cloudtrail_delete = subparser.add_parser('cloudtrail_delete')
    
    kinesis_create.add_argument('--streamname', type=str, required=True)
    kinesis_summary.add_argument('--streamname', type=str, required=True)
    kinesis_delete.add_argument('--streamname', type=str, required=True)

    kinesis_data.add_argument('--streamname', type=str, required=True)
    kinesis_data.add_argument('--file_path', type=str, required=True)
    kinesis_data.add_argument('--partitionkey', type=str, required=True)

    s3_upload.add_argument('--bucket', type=str, required=True)
    s3_upload.add_argument('--file_path', type=str, required=True)
    s3_upload.add_argument('--key', type=str, required=True)
    s3_upload.add_argument('--region', type=str, required=True)

    s3_delete.add_argument('--bucket', type=str, required=True)
    s3_delete.add_argument('--key', type=str, required=True)
    
    dynamodb_table_create.add_argument('--table_name', type=str, required=True)
    dynamodb_table_delete.add_argument('--table_name', type=str, required=True)
    dynamodb_table_summary.add_argument('--table_name', type=str, required=True)

    dynamodb_record_create.add_argument('--table_name', type=str, required=True)
    dynamodb_record_create.add_argument('--id', type=int, required=True)
    dynamodb_record_create.add_argument('--value', type=int, required=True)
    
    cloudtrail_create.add_argument('--trailname', type=str, required=True)
    cloudtrail_create.add_argument('--bucketname', type=str, required=True)
    cloudtrail_create.add_argument('--region', type=str, required=True)
    cloudtrail_delete.add_argument('--trailname', type=str, required=True)
    cloudtrail_delete.add_argument('--bucketname', type=str, required=True)

    args = parser.parse_args()

    kinesis_client = boto3.client('kinesis')
    s3_client = boto3.client('s3')
    s3_resource = boto3.resource('s3')
    sts_client = boto3.client('sts')
    cloudtrail_client = boto3.client('cloudtrail')
    dynamo_db_client = boto3.client('dynamodb')
    dynamo_db_resource = boto3.resource('dynamodb')
   
    try:
        if args.command == 'kinesis_create':
            create_kinesis_stream(kinesis_client, args.streamname)
        elif args.command == 'kinesis_summary':
            get_stream_summary(kinesis_client, args.streamname)
        elif args.command == 'kinesis_data':
            push_kinesis_data(kinesis_client, args.streamname, args.partitionkey, args.file_path)
        elif args.command == 'kinesis_delete':
            delete_kinesis_stream(kinesis_client, args.streamname)
        elif args.command == 's3_upload':
            s3_upload_file(s3_client, args.bucket, args.file_path, args.key, args.region)
        elif args.command == 's3_delete':
            s3_delete_file(s3_client, args.bucket, args.key)
        elif args.command == 'dynamodb_table_create':
            create_dynamodb_table(dynamo_db_client, args.table_name)
        elif args.command == 'dynamodb_table_delete':
            delete_dynamodb_table(dynamo_db_client, args.table_name)
        elif args.command == 'dynamodb_table_summary':
            get_dynamodb_table_summary(dynamo_db_client, args.table_name)
        elif args.command == 'dynamodb_record_create':
            create_dynamodb_record(dynamo_db_resource, args.table_name, args.id, args.value)
        elif args.command == 'cloudtrail_create':
            create_cloudtrail(cloudtrail_client, s3_client, sts_client, args.trailname, args.bucketname, args.region)
        elif args.command == 'cloudtrail_delete':
            delete_cloudtrail(cloudtrail_client, s3_client, s3_resource, args.trailname, args.bucketname)


    except Exception as e:
        print(e)
