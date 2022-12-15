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



if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    subparser = parser.add_subparsers(dest='command')
    kinesis_create = subparser.add_parser('kinesis_create')
    kinesis_summary = subparser.add_parser('kinesis_summary')
    kinesis_data = subparser.add_parser('kinesis_data')
    kinesis_delete = subparser.add_parser('kinesis_delete')
    s3_upload = subparser.add_parser('s3_upload')
    s3_delete = subparser.add_parser('s3_delete')

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

    args = parser.parse_args()

    kinesis_client = boto3.client('kinesis')
    s3_client = boto3.client('s3')

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
    except Exception as e:
        print(e)
